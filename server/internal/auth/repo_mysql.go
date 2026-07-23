package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
)

type mysqlUserRepo struct{ db *sql.DB }

func NewMySQLUserRepo(db *sql.DB) UserRepo { return &mysqlUserRepo{db: db} }

func (r *mysqlUserRepo) ByEmail(ctx context.Context, email string) (*UserRecord, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, email, password_hash, role, created_at
		FROM admin_users WHERE LOWER(email) = LOWER(?) LIMIT 1`, strings.TrimSpace(email))
	var u UserRecord
	var idStr string
	if err := row.Scan(&idStr, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("auth: mysql by-email: %w", err)
	}
	u.ID, _ = uuid.Parse(idStr)
	return &u, nil
}

func (r *mysqlUserRepo) ByID(ctx context.Context, id uuid.UUID) (*UserRecord, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, email, password_hash, role, created_at FROM admin_users WHERE id = ?`, id.String())
	var u UserRecord
	var idStr string
	if err := row.Scan(&idStr, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("auth: mysql by-id: %w", err)
	}
	u.ID, _ = uuid.Parse(idStr)
	return &u, nil
}

func (r *mysqlUserRepo) Bootstrap(ctx context.Context, email, hash string) (*UserRecord, bool, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	id := uuid.New()
	res, err := r.db.ExecContext(ctx, `
		INSERT INTO admin_users (id, email, password_hash, role)
		VALUES (?, ?, ?, 'admin')
		ON DUPLICATE KEY UPDATE email = email`, id.String(), email, hash)
	if err != nil {
		return nil, false, fmt.Errorf("auth: mysql bootstrap: %w", err)
	}
	n, _ := res.RowsAffected()
	existing, lookupErr := r.ByEmail(ctx, email)
	if lookupErr != nil {
		return nil, false, lookupErr
	}
	return existing, n == 1, nil
}

func (r *mysqlUserRepo) UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE admin_users SET password_hash = ? WHERE id = ?`, hash, id.String())
	if err != nil {
		return fmt.Errorf("auth: mysql update password: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *mysqlUserRepo) UpdateEmail(ctx context.Context, id uuid.UUID, newEmail string) error {
	newEmail = strings.ToLower(strings.TrimSpace(newEmail))
	res, err := r.db.ExecContext(ctx, `UPDATE admin_users SET email = ? WHERE id = ?`, newEmail, id.String())
	if err != nil {
		var me *mysql.MySQLError
		if errors.As(err, &me) && me.Number == 1062 {
			return ErrEmailTaken
		}
		return fmt.Errorf("auth: mysql update email: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *mysqlUserRepo) Count(ctx context.Context) (int, error) {
	var n int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM admin_users`).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

type mysqlSessionRepo struct{ db *sql.DB }

func NewMySQLSessionRepo(db *sql.DB) SessionRepo { return &mysqlSessionRepo{db: db} }

func (r *mysqlSessionRepo) Create(ctx context.Context, s SessionRecord) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO admin_sessions (id, user_id, token, ip, user_agent, expires_at, last_seen_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID.String(), s.UserID.String(), s.Token, nullStr(s.IP), nullStr(s.UserAgent),
		s.ExpiresAt, s.LastSeenAt, s.CreatedAt)
	if err != nil {
		return fmt.Errorf("auth: mysql session create: %w", err)
	}
	return nil
}

func (r *mysqlSessionRepo) ByToken(ctx context.Context, token string) (*SessionRecord, error) {
	if token == "" {
		return nil, ErrSessionNotFound
	}
	row := r.db.QueryRowContext(ctx, `
		SELECT id, user_id, token, COALESCE(ip,''), COALESCE(user_agent,''),
		       created_at, COALESCE(last_seen_at, created_at), expires_at
		FROM admin_sessions WHERE token = ?`, token)
	s, err := scanSession(row)
	if err != nil {
		return nil, err
	}
	if s.ExpiresAt.Before(time.Now().UTC()) {
		return nil, ErrSessionNotFound
	}
	return s, nil
}

func (r *mysqlSessionRepo) ByTokenWithUser(ctx context.Context, token string) (*SessionRecord, *UserRecord, error) {
	if token == "" {
		return nil, nil, ErrSessionNotFound
	}
	row := r.db.QueryRowContext(ctx, `
		SELECT s.id, s.user_id, s.token, COALESCE(s.ip,''), COALESCE(s.user_agent,''),
		       s.created_at, COALESCE(s.last_seen_at, s.created_at), s.expires_at,
		       u.id, u.email, u.password_hash, u.role, u.created_at
		FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
		WHERE s.token = ?`, token)
	var s SessionRecord
	var u UserRecord
	var sid, uid, uuidStr string
	if err := row.Scan(
		&sid, &uid, &s.Token, &s.IP, &s.UserAgent, &s.CreatedAt, &s.LastSeenAt, &s.ExpiresAt,
		&uuidStr, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, ErrSessionNotFound
		}
		return nil, nil, err
	}
	s.ID, _ = uuid.Parse(sid)
	s.UserID, _ = uuid.Parse(uid)
	u.ID, _ = uuid.Parse(uuidStr)
	if s.ExpiresAt.Before(time.Now().UTC()) {
		return nil, nil, ErrSessionNotFound
	}
	return &s, &u, nil
}

func (r *mysqlSessionRepo) Touch(ctx context.Context, token string, newExpiry, lastSeen time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE admin_sessions SET expires_at = ?, last_seen_at = ? WHERE token = ?`,
		newExpiry, lastSeen, token)
	return err
}

func (r *mysqlSessionRepo) Delete(ctx context.Context, token string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM admin_sessions WHERE token = ?`, token)
	return err
}

func (r *mysqlSessionRepo) DeleteByID(ctx context.Context, id, userID uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM admin_sessions WHERE id = ? AND user_id = ?`, id.String(), userID.String())
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrSessionNotFound
	}
	return nil
}

func (r *mysqlSessionRepo) DeleteAllForUser(ctx context.Context, userID uuid.UUID, except string) (int, error) {
	var res sql.Result
	var err error
	if except == "" {
		res, err = r.db.ExecContext(ctx, `DELETE FROM admin_sessions WHERE user_id = ?`, userID.String())
	} else {
		res, err = r.db.ExecContext(ctx, `DELETE FROM admin_sessions WHERE user_id = ? AND token <> ?`, userID.String(), except)
	}
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

func (r *mysqlSessionRepo) ListByUser(ctx context.Context, userID uuid.UUID) ([]SessionRecord, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, token, COALESCE(ip,''), COALESCE(user_agent,''),
		       created_at, COALESCE(last_seen_at, created_at), expires_at
		FROM admin_sessions WHERE user_id = ? AND expires_at > UTC_TIMESTAMP(3)
		ORDER BY created_at DESC`, userID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SessionRecord
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

func (r *mysqlSessionRepo) PurgeExpired(ctx context.Context) (int, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM admin_sessions WHERE expires_at < UTC_TIMESTAMP(3)`)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSession(row rowScanner) (*SessionRecord, error) {
	var s SessionRecord
	var sid, uid string
	if err := row.Scan(&sid, &uid, &s.Token, &s.IP, &s.UserAgent, &s.CreatedAt, &s.LastSeenAt, &s.ExpiresAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	s.ID, _ = uuid.Parse(sid)
	s.UserID, _ = uuid.Parse(uid)
	return &s, nil
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
