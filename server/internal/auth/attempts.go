package auth

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type LoginAttemptRepo interface {
	Record(ctx context.Context, email, ip string, success bool) error
	RecentFailures(ctx context.Context, email, ip string, since time.Time) (int, error)
	Purge(ctx context.Context, before time.Time) (int, error)
}

type LockoutConfig struct {
	Threshold int
	Window    time.Duration
	BlockFor  time.Duration
}

func DefaultLockout() LockoutConfig {
	return LockoutConfig{Threshold: 5, Window: 15 * time.Minute, BlockFor: 15 * time.Minute}
}

type memoryAttemptRepo struct {
	mu      sync.Mutex
	entries []memoryAttempt
}

type memoryAttempt struct {
	Email string
	IP    string
	OK    bool
	At    time.Time
}

func NewMemoryAttemptRepo() LoginAttemptRepo { return &memoryAttemptRepo{} }

func (r *memoryAttemptRepo) Record(_ context.Context, email, ip string, success bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.entries = append(r.entries, memoryAttempt{
		Email: strings.ToLower(strings.TrimSpace(email)),
		IP:    ip,
		OK:    success,
		At:    time.Now().UTC(),
	})
	return nil
}

func (r *memoryAttemptRepo) RecentFailures(_ context.Context, email, ip string, since time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	email = strings.ToLower(strings.TrimSpace(email))
	emailMatches, ipMatches := 0, 0
	for _, e := range r.entries {
		if e.OK || e.At.Before(since) {
			continue
		}
		if email != "" && e.Email == email {
			emailMatches++
		}
		if ip != "" && e.IP == ip {
			ipMatches++
		}
	}
	if emailMatches > ipMatches {
		return emailMatches, nil
	}
	return ipMatches, nil
}

func (r *memoryAttemptRepo) Purge(_ context.Context, before time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := r.entries[:0]
	removed := 0
	for _, e := range r.entries {
		if e.At.Before(before) {
			removed++
			continue
		}
		out = append(out, e)
	}
	r.entries = out
	return removed, nil
}

type mysqlAttemptRepo struct{ db *sql.DB }

func NewMySQLAttemptRepo(db *sql.DB) LoginAttemptRepo { return &mysqlAttemptRepo{db: db} }

func (r *mysqlAttemptRepo) Record(ctx context.Context, email, ip string, success bool) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO admin_login_attempts (id, email, ip, succeeded, attempted_at)
		VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
		uuid.New().String(), strings.ToLower(strings.TrimSpace(email)), ip, success)
	if err != nil {
		return fmt.Errorf("auth: attempt record: %w", err)
	}
	return nil
}

func (r *mysqlAttemptRepo) RecentFailures(ctx context.Context, email, ip string, since time.Time) (int, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT GREATEST(
			(SELECT COUNT(*) FROM admin_login_attempts
			 WHERE succeeded = 0 AND attempted_at > ? AND LOWER(email) = LOWER(?)),
			(SELECT COUNT(*) FROM admin_login_attempts
			 WHERE succeeded = 0 AND attempted_at > ? AND ip = ?)
		)`, since, strings.TrimSpace(email), since, ip)
	var n int
	if err := row.Scan(&n); err != nil {
		return 0, fmt.Errorf("auth: attempt count: %w", err)
	}
	return n, nil
}

func (r *mysqlAttemptRepo) Purge(ctx context.Context, before time.Time) (int, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM admin_login_attempts WHERE attempted_at < ?`, before)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}
