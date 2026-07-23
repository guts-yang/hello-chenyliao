package auth

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ErrUserNotFound is returned by UserRepo when the email is unknown. It is
// intentionally distinct from a generic error so the service can swap a
// "user-not-found" into the same "invalid credentials" surface as "wrong
// password" without leaking which one occurred.
var ErrUserNotFound = errors.New("auth: user not found")

// ErrSessionNotFound is returned by SessionRepo when no row matches.
var ErrSessionNotFound = errors.New("auth: session not found")

// ErrCombinedLookupUnsupported means the SessionRepo cannot load session+user
// in one query; the service falls back to ByToken + ByID.
var ErrCombinedLookupUnsupported = errors.New("auth: combined session lookup unsupported")

// ErrEmailTaken is returned by UpdateEmail when the new email already exists
// on another user. With a single-admin deployment this is mostly a guard
// against typos rather than a real conflict.
var ErrEmailTaken = errors.New("auth: email already in use")

// UserRepo persists the admin user. Implementations must keep emails case
// insensitive (we lowercase before comparing) and treat the password_hash
// column as an opaque bcrypt blob.
type UserRepo interface {
	ByEmail(ctx context.Context, email string) (*UserRecord, error)
	ByID(ctx context.Context, id uuid.UUID) (*UserRecord, error)
	Bootstrap(ctx context.Context, email, hash string) (*UserRecord, bool, error)
	UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error
	UpdateEmail(ctx context.Context, id uuid.UUID, newEmail string) error
	Count(ctx context.Context) (int, error)
}

// SessionRepo persists active admin sessions. Implementations are expected to
// purge expired rows lazily on read and explicitly via PurgeExpired().
type SessionRepo interface {
	Create(ctx context.Context, s SessionRecord) error
	ByToken(ctx context.Context, token string) (*SessionRecord, error)
	// ByTokenWithUser loads session + user in one round-trip when supported.
	ByTokenWithUser(ctx context.Context, token string) (*SessionRecord, *UserRecord, error)
	Touch(ctx context.Context, token string, newExpiry time.Time, lastSeen time.Time) error
	Delete(ctx context.Context, token string) error
	DeleteByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	DeleteAllForUser(ctx context.Context, userID uuid.UUID, except string) (int, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]SessionRecord, error)
	PurgeExpired(ctx context.Context) (int, error)
}

// memoryUserRepo is the in-process implementation used when DATABASE_URL is
// empty (the README labels this dev-only). It keeps a single admin entry
// because the rest of the design assumes one admin.
type memoryUserRepo struct {
	mu   sync.RWMutex
	user *UserRecord
}

// NewMemoryUserRepo constructs an empty in-memory UserRepo.
func NewMemoryUserRepo() UserRepo { return &memoryUserRepo{} }

func (r *memoryUserRepo) ByEmail(_ context.Context, email string) (*UserRecord, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.user == nil {
		return nil, ErrUserNotFound
	}
	if !strings.EqualFold(r.user.Email, email) {
		return nil, ErrUserNotFound
	}
	copy := *r.user
	return &copy, nil
}

func (r *memoryUserRepo) ByID(_ context.Context, id uuid.UUID) (*UserRecord, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.user == nil || r.user.ID != id {
		return nil, ErrUserNotFound
	}
	copy := *r.user
	return &copy, nil
}

func (r *memoryUserRepo) Bootstrap(_ context.Context, email, hash string) (*UserRecord, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.user != nil {
		copy := *r.user
		return &copy, false, nil
	}
	r.user = &UserRecord{
		ID:           uuid.New(),
		Email:        strings.ToLower(strings.TrimSpace(email)),
		PasswordHash: hash,
		Role:         "admin",
		CreatedAt:    time.Now().UTC(),
	}
	copy := *r.user
	return &copy, true, nil
}

func (r *memoryUserRepo) UpdatePassword(_ context.Context, id uuid.UUID, hash string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.user == nil || r.user.ID != id {
		return ErrUserNotFound
	}
	r.user.PasswordHash = hash
	return nil
}

func (r *memoryUserRepo) UpdateEmail(_ context.Context, id uuid.UUID, newEmail string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.user == nil || r.user.ID != id {
		return ErrUserNotFound
	}
	r.user.Email = strings.ToLower(strings.TrimSpace(newEmail))
	return nil
}

func (r *memoryUserRepo) Count(_ context.Context) (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.user == nil {
		return 0, nil
	}
	return 1, nil
}

// memorySessionRepo keeps sessions in a map keyed by token. Refresh and delete
// operations take O(1); ListByUser walks the whole map, which is fine for the
// single-admin scenario (the only place that matters in dev fallback).
type memorySessionRepo struct {
	mu       sync.RWMutex
	sessions map[string]SessionRecord
}

// NewMemorySessionRepo constructs an empty in-memory SessionRepo.
func NewMemorySessionRepo() SessionRepo {
	return &memorySessionRepo{sessions: map[string]SessionRecord{}}
}

func (r *memorySessionRepo) Create(_ context.Context, s SessionRecord) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sessions[s.Token] = s
	return nil
}

func (r *memorySessionRepo) ByToken(_ context.Context, token string) (*SessionRecord, error) {
	if token == "" {
		return nil, ErrSessionNotFound
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.sessions[token]
	if !ok {
		return nil, ErrSessionNotFound
	}
	if s.ExpiresAt.Before(time.Now().UTC()) {
		return nil, ErrSessionNotFound
	}
	return &s, nil
}

func (r *memorySessionRepo) ByTokenWithUser(ctx context.Context, token string) (*SessionRecord, *UserRecord, error) {
	return nil, nil, ErrCombinedLookupUnsupported
}

func (r *memorySessionRepo) Touch(_ context.Context, token string, newExpiry, lastSeen time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, ok := r.sessions[token]
	if !ok {
		return ErrSessionNotFound
	}
	s.ExpiresAt = newExpiry
	s.LastSeenAt = lastSeen
	r.sessions[token] = s
	return nil
}

func (r *memorySessionRepo) Delete(_ context.Context, token string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.sessions, token)
	return nil
}

func (r *memorySessionRepo) DeleteByID(_ context.Context, id uuid.UUID, userID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for token, s := range r.sessions {
		if s.ID == id && s.UserID == userID {
			delete(r.sessions, token)
			return nil
		}
	}
	return ErrSessionNotFound
}

func (r *memorySessionRepo) DeleteAllForUser(_ context.Context, userID uuid.UUID, except string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	n := 0
	for token, s := range r.sessions {
		if s.UserID != userID {
			continue
		}
		if except != "" && token == except {
			continue
		}
		delete(r.sessions, token)
		n++
	}
	return n, nil
}

func (r *memorySessionRepo) ListByUser(_ context.Context, userID uuid.UUID) ([]SessionRecord, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	now := time.Now().UTC()
	out := make([]SessionRecord, 0)
	for _, s := range r.sessions {
		if s.UserID != userID {
			continue
		}
		if s.ExpiresAt.Before(now) {
			continue
		}
		out = append(out, s)
	}
	return out, nil
}

func (r *memorySessionRepo) PurgeExpired(_ context.Context) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now().UTC()
	n := 0
	for token, s := range r.sessions {
		if s.ExpiresAt.Before(now) {
			delete(r.sessions, token)
			n++
		}
	}
	return n, nil
}
