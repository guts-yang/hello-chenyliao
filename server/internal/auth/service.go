// Package auth owns the admin authentication boundary. The HTTP layer only
// ever sees this Service; the storage shape (MySQL or in-memory) is hidden
// behind UserRepo / SessionRepo.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/guts-yang/hello-gutsyang/server/internal/model"
)

// Mode reports how the service is currently configured. It is used purely for
// startup logging and the /healthz response 鈥?the HTTP layer never branches on
// it for authorization decisions.
type Mode string

const (
	// ModeDisabled means no admin exists yet (no env bootstrap, no row in DB).
	// /v1/admin/login will return 401 for every attempt.
	ModeDisabled Mode = "disabled"
	// ModeMySQL means the admin lives in MySQL (preferred).
	ModeMySQL Mode = "mysql"
	// ModeMemory means we are running with the in-memory fallback. Useful for
	// `npm run dev:backend` without docker; the README labels this dev-only.
	ModeMemory Mode = "memory"
)

// Options configures behavior knobs of the service. Zero values are sensible
// defaults so server.go can pass an empty struct in tests.
type Options struct {
	TTL              time.Duration
	RefreshThreshold time.Duration
	Attempts         LoginAttemptRepo
	Lockout          LockoutConfig
}

// Service is the auth boundary used by the HTTP layer.
type Service struct {
	users    UserRepo
	sessions SessionRepo
	attempts LoginAttemptRepo
	lockout  LockoutConfig
	ttl      time.Duration
	refresh  time.Duration

	mu   sync.RWMutex
	mode Mode
}

// New constructs a Service from a pair of repositories. The mode argument
// declares whether the caller wired MySQL or the in-memory fallback so the
// HTTP layer / startup log can be honest about it.
func New(users UserRepo, sessions SessionRepo, mode Mode, opts Options) *Service {
	ttl := opts.TTL
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}
	refresh := opts.RefreshThreshold
	if refresh <= 0 {
		refresh = 24 * time.Hour
	}
	lockout := opts.Lockout
	if lockout.Threshold <= 0 || lockout.Window <= 0 {
		lockout = DefaultLockout()
	}
	if lockout.BlockFor <= 0 {
		lockout.BlockFor = lockout.Window
	}
	return &Service{
		users:    users,
		sessions: sessions,
		attempts: opts.Attempts,
		lockout:  lockout,
		ttl:      ttl,
		refresh:  refresh,
		mode:     mode,
	}
}

// SetMode lets the bootstrap routine flip ModeDisabled -> ModeMySQL once an
// admin user has been ensured. Without this, a deployment that bootstraps via
// env on first run would keep reporting "disabled" until restart.
func (s *Service) SetMode(m Mode) {
	s.mu.Lock()
	s.mode = m
	s.mu.Unlock()
}

// Enabled returns true when at least one admin user is configured and the
// service is ready to accept logins.
func (s *Service) Enabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.mode != ModeDisabled
}

// GetMode is exposed so /healthz and startup logs can describe the state.
func (s *Service) GetMode() Mode {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.mode
}

// Login verifies credentials and mints a fresh session. ip and userAgent are
// stored on the session row for the Phase 2 settings page; passing empty
// strings is acceptable for tests / non-HTTP callers.
//
// Errors are deliberately collapsed into a single "invalid email or password"
// (with the timing-safe dummy compare) so we never reveal whether the email
// even exists. ErrLockedOut is returned distinctly so the HTTP layer can map
// it to 429 + Retry-After.
func (s *Service) Login(ctx context.Context, email, password, ip, userAgent string) (*model.Session, error) {
	if !s.Enabled() {
		return nil, errors.New("admin auth is not configured")
	}

	if s.attempts != nil && s.lockout.Threshold > 0 {
		since := time.Now().UTC().Add(-s.lockout.Window)
		count, err := s.attempts.RecentFailures(ctx, email, ip, since)
		if err == nil && count >= s.lockout.Threshold {
			return nil, ErrLockedOut
		}
	}

	user, lookupErr := s.users.ByEmail(ctx, email)
	if lookupErr != nil {
		// Spend bcrypt time anyway to avoid revealing existence via timing.
		_ = bcrypt.CompareHashAndPassword([]byte("$2a$10$0000000000000000000000.0000000000000000000000000000"), []byte(password))
		s.recordAttempt(ctx, email, ip, false)
		return nil, errInvalidCredentials
	}

	if subtle.ConstantTimeCompare([]byte(strings.ToLower(user.Email)), []byte(strings.ToLower(email))) != 1 {
		_ = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
		s.recordAttempt(ctx, email, ip, false)
		return nil, errInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		s.recordAttempt(ctx, email, ip, false)
		return nil, errInvalidCredentials
	}

	token, err := randomToken()
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	record := SessionRecord{
		ID:         uuid.New(),
		UserID:     user.ID,
		Token:      token,
		IP:         ip,
		UserAgent:  truncate(userAgent, 256),
		CreatedAt:  now,
		LastSeenAt: now,
		ExpiresAt:  now.Add(s.ttl),
	}
	if err := s.sessions.Create(ctx, record); err != nil {
		return nil, err
	}

	s.recordAttempt(ctx, email, ip, true)
	out := record.ToModel(user.Email, user.Role)
	return &out, nil
}

// LockoutConfig returns the active lockout policy so the HTTP layer can
// produce the right Retry-After header without poking at internals.
func (s *Service) LockoutConfig() LockoutConfig {
	return s.lockout
}

// recordAttempt is best-effort; if the attempts repo is misbehaving we log
// internally but never fail the login because of it.
func (s *Service) recordAttempt(ctx context.Context, email, ip string, success bool) {
	if s.attempts == nil {
		return
	}
	_ = s.attempts.Record(ctx, email, ip, success)
}

// Session resolves a token into the current admin's session, sliding the
// expiry forward if the request happens inside the refresh window. Returns
// (nil, nil) when the token is unknown / expired 鈥?the HTTP layer treats that
// as "anonymous", not as an error.
func (s *Service) Session(ctx context.Context, token string) (*model.Session, error) {
	if token == "" {
		return nil, nil
	}
	var record *SessionRecord
	var user *UserRecord
	var err error

	record, user, err = s.sessions.ByTokenWithUser(ctx, token)
	if errors.Is(err, ErrCombinedLookupUnsupported) {
		record, err = s.sessions.ByToken(ctx, token)
		if err != nil {
			if errors.Is(err, ErrSessionNotFound) {
				return nil, nil
			}
			return nil, err
		}
		user, err = s.users.ByID(ctx, record.UserID)
		if err != nil {
			return nil, nil
		}
	} else if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			return nil, nil
		}
		return nil, err
	}

	now := time.Now().UTC()
	const touchInterval = 15 * time.Minute
	if record.ExpiresAt.Sub(now) < s.refresh {
		newExpiry := now.Add(s.ttl)
		_ = s.sessions.Touch(ctx, token, newExpiry, now)
		record.ExpiresAt = newExpiry
		record.LastSeenAt = now
	} else if now.Sub(record.LastSeenAt) > touchInterval {
		_ = s.sessions.Touch(ctx, token, record.ExpiresAt, now)
		record.LastSeenAt = now
	}

	out := record.ToModel(user.Email, user.Role)
	return &out, nil
}

// SessionWithRecord is like Session but also surfaces the underlying
// SessionRecord so the HTTP layer can show "this is the current device" in
// the sessions list. Kept separate to avoid widening the common Session call
// path.
func (s *Service) SessionWithRecord(ctx context.Context, token string) (*model.Session, *SessionRecord, *UserRecord, error) {
	if token == "" {
		return nil, nil, nil, nil
	}
	record, err := s.sessions.ByToken(ctx, token)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			return nil, nil, nil, nil
		}
		return nil, nil, nil, err
	}
	user, err := s.users.ByID(ctx, record.UserID)
	if err != nil {
		return nil, nil, nil, nil
	}
	session := record.ToModel(user.Email, user.Role)
	return &session, record, user, nil
}

// Logout deletes the session row associated with the given cookie token. It is
// idempotent: unknown tokens succeed silently.
func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return s.sessions.Delete(ctx, token)
}

// ChangePassword verifies currentPassword, bcrypts newPassword, writes it, and
// revokes every other session for the user. The caller may immediately reissue
// a fresh session for the current request via Login.
func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword, exceptToken string) error {
	if err := ValidatePasswordStrength(newPassword); err != nil {
		return err
	}
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return errInvalidCredentials
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := s.users.UpdatePassword(ctx, userID, string(hash)); err != nil {
		return err
	}
	if _, err := s.sessions.DeleteAllForUser(ctx, userID, exceptToken); err != nil {
		return err
	}
	return nil
}

// ChangeEmail verifies currentPassword and writes the new email. Returns
// ErrEmailTaken if newEmail clashes; the HTTP layer turns that into a 409.
func (s *Service) ChangeEmail(ctx context.Context, userID uuid.UUID, currentPassword, newEmail string) error {
	if !validEmail(newEmail) {
		return errInvalidEmail
	}
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return errInvalidCredentials
	}
	return s.users.UpdateEmail(ctx, userID, newEmail)
}

// ListSessions returns the user's active sessions sorted newest-first.
func (s *Service) ListSessions(ctx context.Context, userID uuid.UUID) ([]SessionRecord, error) {
	return s.sessions.ListByUser(ctx, userID)
}

// RevokeSession deletes one session by id, but only if it belongs to userID.
// Returns ErrSessionNotFound when there is no match.
func (s *Service) RevokeSession(ctx context.Context, userID, sessionID uuid.UUID) error {
	return s.sessions.DeleteByID(ctx, sessionID, userID)
}

// RevokeOtherSessions wipes every session for the user except the one matched
// by exceptToken (which is typically the current request's cookie).
func (s *Service) RevokeOtherSessions(ctx context.Context, userID uuid.UUID, exceptToken string) (int, error) {
	return s.sessions.DeleteAllForUser(ctx, userID, exceptToken)
}

// HashPassword is a thin wrapper around bcrypt.GenerateFromPassword for the
// CLI hash helper. Exported so cmd/api and tests can use the same cost.
func HashPassword(plain string) (string, error) {
	if err := ValidatePasswordStrength(plain); err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// ValidatePasswordStrength enforces a minimal floor (length 8) so callers can
// not accidentally write trivially-bruteforceable passwords through the CLI or
// /v1/admin/password endpoint.
func ValidatePasswordStrength(plain string) error {
	if len(plain) < 8 {
		return fmt.Errorf("auth: password must be at least 8 characters")
	}
	return nil
}

// PurgeExpired delegates to the session repo and is meant to be called from a
// background goroutine; the server wires that loop in Run().
func (s *Service) PurgeExpired(ctx context.Context) (int, error) {
	return s.sessions.PurgeExpired(ctx)
}

// errInvalidCredentials is the single error surface for all wrong-creds paths
// (unknown email, wrong password, mismatched email after lookup). The HTTP
// layer translates it into a stable 401 message.
var errInvalidCredentials = errors.New("auth: invalid email or password")

// errInvalidEmail is returned when ChangeEmail receives something that
// doesn't parse as a valid RFC 5322 address. The HTTP layer maps it to 400.
var errInvalidEmail = errors.New("auth: invalid email")

// ErrLockedOut signals that the email or IP exceeded the failed-attempt
// threshold and the caller must back off. The HTTP layer renders it as 429
// with a Retry-After header derived from LockoutConfig.BlockFor.
var ErrLockedOut = errors.New("auth: too many failed login attempts")

// IsInvalidCredentials reports whether an error came from the credential
// verification path (so the HTTP layer can return 401 without leaking
// specifics). It also catches ErrUserNotFound from the repo.
func IsInvalidCredentials(err error) bool {
	return errors.Is(err, errInvalidCredentials)
}

// IsInvalidEmail reports whether an error came from email validation.
func IsInvalidEmail(err error) bool {
	return errors.Is(err, errInvalidEmail)
}

// IsLockedOut reports whether the error is the lockout sentinel.
func IsLockedOut(err error) bool {
	return errors.Is(err, ErrLockedOut)
}

func randomToken() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate session token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// NewCSRFToken returns a 32-byte hex string suitable for the double-submit
// cookie that backs the CSRF defense. Exported so the HTTP layer can mint a
// fresh value alongside the session cookie on login.
func NewCSRFToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate csrf token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// CompareCSRFTokens does a constant-time comparison so an attacker cannot
// brute-force the token via timing side channels.
func CompareCSRFTokens(a, b string) bool {
	if a == "" || b == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func validEmail(s string) bool {
	addr, err := mail.ParseAddress(strings.TrimSpace(s))
	if err != nil {
		return false
	}
	return addr.Address != ""
}
