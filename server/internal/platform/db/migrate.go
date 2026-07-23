package db

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type Migration struct {
	Version int
	Name    string
	SQL     string
}

type AppliedMigration struct {
	Version   int
	Name      string
	AppliedAt time.Time
}

type StatusEntry struct {
	Version int
	Name    string
	Applied bool
	At      time.Time
}

func Open(ctx context.Context, dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, fmt.Errorf("db: empty dsn")
	}
	dsn = normalizeDSN(dsn)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("db: open: %w", err)
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("db: ping: %w", err)
	}
	return db, nil
}

func normalizeDSN(dsn string) string {
	dsn = strings.TrimSpace(dsn)
	dsn = strings.TrimPrefix(dsn, "mysql://")
	if !strings.Contains(dsn, "parseTime=") {
		if strings.Contains(dsn, "?") {
			dsn += "&parseTime=true"
		} else {
			dsn += "?parseTime=true"
		}
	}
	if !strings.Contains(dsn, "loc=") {
		dsn += "&loc=UTC"
	}
	if !strings.Contains(dsn, "charset=") {
		dsn += "&charset=utf8mb4"
	}
	return dsn
}

func LoadMigrations(efs fs.FS) ([]Migration, error) {
	entries, err := fs.ReadDir(efs, ".")
	if err != nil {
		return nil, fmt.Errorf("migrate: read dir: %w", err)
	}
	out := make([]Migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".sql") {
			continue
		}
		stem := strings.TrimSuffix(name, ".sql")
		parts := strings.SplitN(stem, "_", 2)
		if len(parts) != 2 {
			continue
		}
		version, err := strconv.Atoi(parts[0])
		if err != nil {
			continue
		}
		body, err := fs.ReadFile(efs, path.Join(".", name))
		if err != nil {
			return nil, fmt.Errorf("migrate: read %s: %w", name, err)
		}
		out = append(out, Migration{Version: version, Name: parts[1], SQL: string(body)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Version < out[j].Version })
	for i := 1; i < len(out); i++ {
		if out[i].Version == out[i-1].Version {
			return nil, fmt.Errorf("migrate: duplicate version %d", out[i].Version)
		}
	}
	return out, nil
}

func EnsureMigrationsTable(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INT NOT NULL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
	`)
	if err != nil {
		return fmt.Errorf("migrate: ensure table: %w", err)
	}
	return nil
}

func AppliedVersions(ctx context.Context, db *sql.DB) ([]AppliedMigration, error) {
	rows, err := db.QueryContext(ctx, `SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC`)
	if err != nil {
		return nil, fmt.Errorf("migrate: list applied: %w", err)
	}
	defer rows.Close()
	var out []AppliedMigration
	for rows.Next() {
		var m AppliedMigration
		if err := rows.Scan(&m.Version, &m.Name, &m.AppliedAt); err != nil {
			return nil, fmt.Errorf("migrate: scan: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func Up(ctx context.Context, db *sql.DB, efs fs.FS) ([]Migration, error) {
	if err := EnsureMigrationsTable(ctx, db); err != nil {
		return nil, err
	}
	migrations, err := LoadMigrations(efs)
	if err != nil {
		return nil, err
	}
	applied, err := AppliedVersions(ctx, db)
	if err != nil {
		return nil, err
	}
	appliedSet := make(map[int]struct{}, len(applied))
	for _, m := range applied {
		appliedSet[m.Version] = struct{}{}
	}
	var ran []Migration
	for _, m := range migrations {
		if _, ok := appliedSet[m.Version]; ok {
			continue
		}
		if err := applyOne(ctx, db, m); err != nil {
			return ran, err
		}
		ran = append(ran, m)
	}
	return ran, nil
}

func Status(ctx context.Context, db *sql.DB, efs fs.FS) ([]StatusEntry, error) {
	if err := EnsureMigrationsTable(ctx, db); err != nil {
		return nil, err
	}
	migrations, err := LoadMigrations(efs)
	if err != nil {
		return nil, err
	}
	applied, err := AppliedVersions(ctx, db)
	if err != nil {
		return nil, err
	}
	appliedMap := make(map[int]AppliedMigration, len(applied))
	for _, m := range applied {
		appliedMap[m.Version] = m
	}
	out := make([]StatusEntry, 0, len(migrations))
	for _, m := range migrations {
		e := StatusEntry{Version: m.Version, Name: m.Name}
		if a, ok := appliedMap[m.Version]; ok {
			e.Applied = true
			e.At = a.AppliedAt
		}
		out = append(out, e)
	}
	return out, nil
}

func applyOne(ctx context.Context, db *sql.DB, m Migration) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("migrate %03d: begin: %w", m.Version, err)
	}
	defer func() { _ = tx.Rollback() }()

	for _, stmt := range splitSQL(m.SQL) {
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("migrate %03d_%s: %w", m.Version, m.Name, err)
		}
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, UTC_TIMESTAMP(3))`,
		m.Version, m.Name,
	); err != nil {
		return fmt.Errorf("migrate %03d: bookkeeping: %w", m.Version, err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("migrate %03d: commit: %w", m.Version, err)
	}
	return nil
}

func splitSQL(body string) []string {
	var stmts []string
	var b strings.Builder
	lines := strings.Split(body, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "--") {
			continue
		}
		b.WriteString(line)
		b.WriteByte('\n')
		if strings.HasSuffix(trimmed, ";") {
			stmt := strings.TrimSpace(b.String())
			stmt = strings.TrimSuffix(stmt, ";")
			stmt = strings.TrimSpace(stmt)
			if stmt != "" {
				stmts = append(stmts, stmt)
			}
			b.Reset()
		}
	}
	if rem := strings.TrimSpace(b.String()); rem != "" {
		stmts = append(stmts, rem)
	}
	return stmts
}
