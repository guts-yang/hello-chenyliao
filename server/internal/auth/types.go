package auth

import (
	"time"

	"github.com/google/uuid"

	"github.com/guts-yang/hello-gutsyang/server/internal/model"
)

// UserRecord is the internal admin user representation, kept richer than the
// public model.User which only exposes email/role to the HTTP layer.
type UserRecord struct {
	ID           uuid.UUID
	Email        string
	PasswordHash string
	Role         string
	CreatedAt    time.Time
}

// SessionRecord is the internal session row. IP / UserAgent / LastSeenAt are
// populated from Phase 2 (002_admin_session_meta.sql) onward; on the Phase 1
// schema they remain empty / zero.
type SessionRecord struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Token      string
	IP         string
	UserAgent  string
	CreatedAt  time.Time
	LastSeenAt time.Time
	ExpiresAt  time.Time
}

// ToModel returns the trimmed-down session shape that the HTTP layer hands
// back to the browser. We intentionally omit IP/UA/session ID here so older
// clients keep working unchanged.
func (s SessionRecord) ToModel(email, role string) model.Session {
	return model.Session{
		Token: s.Token,
		User: model.User{
			Email: email,
			Role:  role,
		},
		ExpiresAt: s.ExpiresAt,
	}
}
