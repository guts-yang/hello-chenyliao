package chat

import (
	"context"
	"database/sql"
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

var ErrSessionNotFound = errors.New("chat: session not found")

type Session struct {
	ID        uuid.UUID
	OwnerID   uuid.UUID
	Title     string
	Locale    string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Message struct {
	ID        uuid.UUID
	SessionID uuid.UUID
	Role      string
	Content   string
	CreatedAt time.Time
}

type Repo interface {
	EnsureSession(ctx context.Context, ownerID, sessionID uuid.UUID, title, locale string) (Session, error)
	Touch(ctx context.Context, sessionID uuid.UUID) error
	AppendMessage(ctx context.Context, sessionID uuid.UUID, role, content string) error
	ListSessions(ctx context.Context, ownerID uuid.UUID) ([]Session, error)
	GetMessages(ctx context.Context, ownerID, sessionID uuid.UUID) ([]Message, error)
	DeleteSession(ctx context.Context, ownerID, sessionID uuid.UUID) error
}

func NewRepo(db *sql.DB) Repo {
	if db == nil {
		return NewMemoryRepo()
	}
	return &mysqlRepo{db: db}
}

func SummarizeTitle(raw string) string {
	cleaned := []rune{}
	prevSpace := false
	for _, r := range raw {
		if r == '\n' || r == '\r' || r == '\t' {
			r = ' '
		}
		if r == ' ' {
			if prevSpace {
				continue
			}
			prevSpace = true
		} else {
			prevSpace = false
		}
		cleaned = append(cleaned, r)
	}
	out := string(cleaned)
	for len(out) > 0 && out[0] == ' ' {
		out = out[1:]
	}
	for len(out) > 0 && out[len(out)-1] == ' ' {
		out = out[:len(out)-1]
	}
	r := []rune(out)
	if len(r) > 30 {
		out = string(r[:30]) + "…"
	}
	if out == "" {
		return "New chat"
	}
	return out
}

// --- memory ---

type memoryRepo struct {
	mu       sync.RWMutex
	sessions map[uuid.UUID]Session
	messages map[uuid.UUID][]Message
}

func NewMemoryRepo() Repo {
	return &memoryRepo{
		sessions: map[uuid.UUID]Session{},
		messages: map[uuid.UUID][]Message{},
	}
}

func (r *memoryRepo) EnsureSession(_ context.Context, ownerID, sessionID uuid.UUID, title, locale string) (Session, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if sessionID != uuid.Nil {
		s, ok := r.sessions[sessionID]
		if !ok || s.OwnerID != ownerID {
			return Session{}, ErrSessionNotFound
		}
		return s, nil
	}
	now := time.Now().UTC()
	s := Session{
		ID: uuid.New(), OwnerID: ownerID, Title: title, Locale: locale,
		CreatedAt: now, UpdatedAt: now,
	}
	r.sessions[s.ID] = s
	r.messages[s.ID] = nil
	return s, nil
}

func (r *memoryRepo) Touch(_ context.Context, sessionID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, ok := r.sessions[sessionID]
	if !ok {
		return ErrSessionNotFound
	}
	s.UpdatedAt = time.Now().UTC()
	r.sessions[sessionID] = s
	return nil
}

func (r *memoryRepo) AppendMessage(_ context.Context, sessionID uuid.UUID, role, content string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.sessions[sessionID]; !ok {
		return ErrSessionNotFound
	}
	msg := Message{
		ID: uuid.New(), SessionID: sessionID, Role: role, Content: content,
		CreatedAt: time.Now().UTC(),
	}
	r.messages[sessionID] = append(r.messages[sessionID], msg)
	s := r.sessions[sessionID]
	s.UpdatedAt = msg.CreatedAt
	r.sessions[sessionID] = s
	return nil
}

func (r *memoryRepo) ListSessions(_ context.Context, ownerID uuid.UUID) ([]Session, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Session, 0)
	for _, s := range r.sessions {
		if s.OwnerID == ownerID {
			out = append(out, s)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) })
	return out, nil
}

func (r *memoryRepo) GetMessages(_ context.Context, ownerID, sessionID uuid.UUID) ([]Message, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.sessions[sessionID]
	if !ok || s.OwnerID != ownerID {
		return nil, ErrSessionNotFound
	}
	msgs := append([]Message(nil), r.messages[sessionID]...)
	return msgs, nil
}

func (r *memoryRepo) DeleteSession(_ context.Context, ownerID, sessionID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, ok := r.sessions[sessionID]
	if !ok || s.OwnerID != ownerID {
		return ErrSessionNotFound
	}
	delete(r.sessions, sessionID)
	delete(r.messages, sessionID)
	return nil
}

// --- mysql ---

type mysqlRepo struct{ db *sql.DB }

func (r *mysqlRepo) EnsureSession(ctx context.Context, ownerID, sessionID uuid.UUID, title, locale string) (Session, error) {
	if sessionID != uuid.Nil {
		row := r.db.QueryRowContext(ctx, `
			SELECT id, owner_id, title, locale, created_at, updated_at
			FROM chat_sessions WHERE id=? AND owner_id=?`, sessionID.String(), ownerID.String())
		s, err := scanSession(row)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return Session{}, ErrSessionNotFound
			}
			return Session{}, err
		}
		return s, nil
	}
	now := time.Now().UTC()
	s := Session{ID: uuid.New(), OwnerID: ownerID, Title: title, Locale: locale, CreatedAt: now, UpdatedAt: now}
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO chat_sessions (id, owner_id, title, locale, created_at, updated_at)
		VALUES (?,?,?,?,?,?)`, s.ID.String(), ownerID.String(), title, locale, now, now)
	return s, err
}

func (r *mysqlRepo) Touch(ctx context.Context, sessionID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `UPDATE chat_sessions SET updated_at=UTC_TIMESTAMP(3) WHERE id=?`, sessionID.String())
	return err
}

func (r *mysqlRepo) AppendMessage(ctx context.Context, sessionID uuid.UUID, role, content string) error {
	id := uuid.New()
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?,?,?,?,?)`,
		id.String(), sessionID.String(), role, content, now)
	if err != nil {
		return err
	}
	_, _ = r.db.ExecContext(ctx, `UPDATE chat_sessions SET updated_at=? WHERE id=?`, now, sessionID.String())
	return nil
}

func (r *mysqlRepo) ListSessions(ctx context.Context, ownerID uuid.UUID) ([]Session, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, owner_id, title, locale, created_at, updated_at
		FROM chat_sessions WHERE owner_id=? ORDER BY updated_at DESC`, ownerID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Session
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *mysqlRepo) GetMessages(ctx context.Context, ownerID, sessionID uuid.UUID) ([]Message, error) {
	var n int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM chat_sessions WHERE id=? AND owner_id=?`,
		sessionID.String(), ownerID.String()).Scan(&n); err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, ErrSessionNotFound
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, session_id, role, content, created_at FROM chat_messages
		WHERE session_id=? ORDER BY created_at ASC`, sessionID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		var mid, sid string
		if err := rows.Scan(&mid, &sid, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		m.ID, _ = uuid.Parse(mid)
		m.SessionID, _ = uuid.Parse(sid)
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *mysqlRepo) DeleteSession(ctx context.Context, ownerID, sessionID uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM chat_sessions WHERE id=? AND owner_id=?`,
		sessionID.String(), ownerID.String())
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrSessionNotFound
	}
	return nil
}

type rowScan interface{ Scan(dest ...any) error }

func scanSession(row rowScan) (Session, error) {
	var s Session
	var id, owner string
	if err := row.Scan(&id, &owner, &s.Title, &s.Locale, &s.CreatedAt, &s.UpdatedAt); err != nil {
		return s, err
	}
	s.ID, _ = uuid.Parse(id)
	s.OwnerID, _ = uuid.Parse(owner)
	return s, nil
}
