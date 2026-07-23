package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Entry struct {
	ID        uuid.UUID
	UserID    *uuid.UUID
	Action    string
	Target    string
	IP        string
	UserAgent string
	Meta      map[string]any
	CreatedAt time.Time
}

type ListFilter struct {
	Action string
	Limit  int
	Before time.Time
}

type Repo interface {
	Record(ctx context.Context, e Entry) error
	List(ctx context.Context, f ListFilter) ([]Entry, error)
}

type Service struct{ repo Repo }

func NewService(repo Repo) *Service { return &Service{repo: repo} }

func (s *Service) Record(ctx context.Context, e Entry) {
	if s == nil || s.repo == nil {
		return
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	_ = s.repo.Record(ctx, e)
}

func (s *Service) List(ctx context.Context, f ListFilter) ([]Entry, error) {
	if s == nil || s.repo == nil {
		return nil, nil
	}
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 50
	}
	return s.repo.List(ctx, f)
}

type memoryRepo struct {
	mu      sync.RWMutex
	entries []Entry
}

func NewMemoryRepo() Repo { return &memoryRepo{} }

func (r *memoryRepo) Record(_ context.Context, e Entry) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.entries = append(r.entries, e)
	return nil
}

func (r *memoryRepo) List(_ context.Context, f ListFilter) ([]Entry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Entry, 0, len(r.entries))
	for _, e := range r.entries {
		if f.Action != "" && e.Action != f.Action {
			continue
		}
		if !f.Before.IsZero() && !e.CreatedAt.Before(f.Before) {
			continue
		}
		out = append(out, e)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	if len(out) > f.Limit {
		out = out[:f.Limit]
	}
	return out, nil
}

type mysqlRepo struct{ db *sql.DB }

func NewMySQLRepo(db *sql.DB) Repo { return &mysqlRepo{db: db} }

func (r *mysqlRepo) Record(ctx context.Context, e Entry) error {
	var meta any
	if e.Meta != nil {
		raw, err := json.Marshal(e.Meta)
		if err != nil {
			return err
		}
		meta = raw
	}
	var userID any
	if e.UserID != nil {
		userID = e.UserID.String()
	}
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO admin_audit (id, user_id, action, target, ip, user_agent, meta, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		e.ID.String(), userID, e.Action, nullStr(e.Target), nullStr(e.IP), nullStr(e.UserAgent), meta, e.CreatedAt)
	if err != nil {
		return fmt.Errorf("audit: insert: %w", err)
	}
	return nil
}

func (r *mysqlRepo) List(ctx context.Context, f ListFilter) ([]Entry, error) {
	conds := []string{}
	args := []any{}
	if f.Action != "" {
		conds = append(conds, "action = ?")
		args = append(args, f.Action)
	}
	if !f.Before.IsZero() {
		conds = append(conds, "created_at < ?")
		args = append(args, f.Before)
	}
	q := `SELECT id, user_id, action, COALESCE(target,''), COALESCE(ip,''), COALESCE(user_agent,''),
	             COALESCE(CAST(meta AS CHAR), ''), created_at FROM admin_audit`
	if len(conds) > 0 {
		q += " WHERE " + strings.Join(conds, " AND ")
	}
	q += " ORDER BY created_at DESC LIMIT ?"
	args = append(args, f.Limit)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Entry, 0)
	for rows.Next() {
		var e Entry
		var idStr string
		var userID sql.NullString
		var metaText string
		if err := rows.Scan(&idStr, &userID, &e.Action, &e.Target, &e.IP, &e.UserAgent, &metaText, &e.CreatedAt); err != nil {
			return nil, err
		}
		e.ID, _ = uuid.Parse(idStr)
		if userID.Valid && userID.String != "" {
			u, _ := uuid.Parse(userID.String)
			e.UserID = &u
		}
		if metaText != "" {
			_ = json.Unmarshal([]byte(metaText), &e.Meta)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
