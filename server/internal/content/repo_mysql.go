package content

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/guts-yang/hello-gutsyang/server/internal/model"
)

type mysqlRepo struct{ db *sql.DB }

func (r *mysqlRepo) IsEmpty(ctx context.Context) (bool, error) {
	var n int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM profile`).Scan(&n); err != nil {
		return false, err
	}
	return n == 0, nil
}

func (r *mysqlRepo) Home(ctx context.Context) (model.HomeContent, error) {
	profile, err := r.Profile(ctx)
	if err != nil {
		return model.HomeContent{}, err
	}
	projects, err := r.Projects(ctx, false)
	if err != nil {
		return model.HomeContent{}, err
	}
	experiences, err := r.Experiences(ctx, false)
	if err != nil {
		return model.HomeContent{}, err
	}
	honors, err := r.Honors(ctx, false)
	if err != nil {
		return model.HomeContent{}, err
	}
	education, err := r.Education(ctx)
	if err != nil {
		return model.HomeContent{}, err
	}
	timeline, err := r.Timeline(ctx)
	if err != nil {
		return model.HomeContent{}, err
	}
	return model.HomeContent{
		Profile: profile, Projects: projects, Experiences: experiences,
		Honors: honors, Education: education, Timeline: timeline,
	}, nil
}

func (r *mysqlRepo) Snapshot(ctx context.Context) (model.ContentSnapshot, error) {
	home, err := r.Home(ctx)
	if err != nil {
		return model.ContentSnapshot{}, err
	}
	projects, _ := r.Projects(ctx, true)
	experiences, _ := r.Experiences(ctx, true)
	honors, _ := r.Honors(ctx, true)
	return model.ContentSnapshot{
		Profile: home.Profile, Projects: projects, Experiences: experiences,
		Honors: honors, Education: home.Education, Timeline: home.Timeline,
	}, nil
}

func (r *mysqlRepo) ImportSnapshot(ctx context.Context, snap model.ContentSnapshot) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for _, q := range []string{
		`DELETE FROM timeline`, `DELETE FROM education`, `DELETE FROM honors`,
		`DELETE FROM experiences`, `DELETE FROM projects`, `DELETE FROM profile`,
	} {
		if _, err := tx.ExecContext(ctx, q); err != nil {
			return err
		}
	}
	socials, _ := json.Marshal(snap.Profile.Socials)
	if socials == nil {
		socials = []byte("[]")
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO profile (id, name_zh, name_en, handle, role_zh, role_en, slogan_zh, slogan_en,
			bio_zh, bio_en, avatar_url, socials, updated_at)
		VALUES ('main',?,?,?,?,?,?,?,?,?,?,?,?)`,
		snap.Profile.NameZH, snap.Profile.NameEN, snap.Profile.Handle,
		snap.Profile.Role.ZH, snap.Profile.Role.EN,
		snap.Profile.Slogan.ZH, snap.Profile.Slogan.EN,
		snap.Profile.Bio.ZH, snap.Profile.Bio.EN,
		nullStr(snap.Profile.AvatarURL), socials, time.Now().UTC(),
	); err != nil {
		return err
	}
	for _, p := range snap.Projects {
		if err := upsertProjectTx(ctx, tx, p); err != nil {
			return err
		}
	}
	for _, e := range snap.Experiences {
		if err := upsertExperienceTx(ctx, tx, e); err != nil {
			return err
		}
	}
	for _, h := range snap.Honors {
		if err := upsertHonorTx(ctx, tx, h); err != nil {
			return err
		}
	}
	for _, e := range snap.Education {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO education (id, school_zh, school_en, degree_zh, degree_en, notes_zh, notes_en,
				started_at, ended_at, display_order)
			VALUES (?,?,?,?,?,?,?,?,?,?)`,
			e.ID, e.School.ZH, e.School.EN, e.Degree.ZH, e.Degree.EN,
			nullStr(e.Notes.ZH), nullStr(e.Notes.EN),
			parseDate(e.StartedAt), parseDatePtr(e.EndedAt), e.DisplayOrder,
		); err != nil {
			return err
		}
	}
	for _, t := range snap.Timeline {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO timeline (id, date, kind, title_zh, title_en, body_zh, body_en)
			VALUES (?,?,?,?,?,?,?)`,
			t.ID, parseDate(t.Date), t.Kind, t.Title.ZH, t.Title.EN, t.Body.ZH, t.Body.EN,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *mysqlRepo) Profile(ctx context.Context) (model.Profile, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, name_zh, name_en, handle, role_zh, role_en, slogan_zh, slogan_en,
		       bio_zh, bio_en, COALESCE(avatar_url,''), socials, updated_at FROM profile WHERE id='main'`)
	var p model.Profile
	var socials []byte
	if err := row.Scan(&p.ID, &p.NameZH, &p.NameEN, &p.Handle,
		&p.Role.ZH, &p.Role.EN, &p.Slogan.ZH, &p.Slogan.EN,
		&p.Bio.ZH, &p.Bio.EN, &p.AvatarURL, &socials, &p.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return p, ErrNotFound
		}
		return p, err
	}
	_ = json.Unmarshal(socials, &p.Socials)
	if p.Socials == nil {
		p.Socials = []model.SocialLink{}
	}
	return p, nil
}

func (r *mysqlRepo) UpdateProfile(ctx context.Context, next model.Profile) (model.Profile, error) {
	socials, _ := json.Marshal(next.Socials)
	next.UpdatedAt = time.Now().UTC()
	_, err := r.db.ExecContext(ctx, `
		UPDATE profile SET name_zh=?, name_en=?, handle=?, role_zh=?, role_en=?,
			slogan_zh=?, slogan_en=?, bio_zh=?, bio_en=?, avatar_url=?, socials=?, updated_at=?
		WHERE id='main'`,
		next.NameZH, next.NameEN, next.Handle, next.Role.ZH, next.Role.EN,
		next.Slogan.ZH, next.Slogan.EN, next.Bio.ZH, next.Bio.EN,
		nullStr(next.AvatarURL), socials, next.UpdatedAt)
	if err != nil {
		return next, err
	}
	next.ID = "main"
	return next, nil
}

func (r *mysqlRepo) Projects(ctx context.Context, includeDrafts bool) ([]model.Project, error) {
	q := `SELECT id, slug, kind, title_zh, title_en, tagline_zh, tagline_en, summary_zh, summary_en,
		tags, highlights, COALESCE(link,''), COALESCE(repo,''), COALESCE(cover_url,''),
		DATE_FORMAT(started_at,'%Y-%m'), IFNULL(DATE_FORMAT(ended_at,'%Y-%m'),''),
		display_order, is_published FROM projects`
	if !includeDrafts {
		q += ` WHERE is_published=1`
	}
	q += ` ORDER BY display_order DESC, started_at DESC`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Project
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *mysqlRepo) ProjectBySlug(ctx context.Context, slug string) (*model.Project, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, slug, kind, title_zh, title_en, tagline_zh, tagline_en, summary_zh, summary_en,
		tags, highlights, COALESCE(link,''), COALESCE(repo,''), COALESCE(cover_url,''),
		DATE_FORMAT(started_at,'%Y-%m'), IFNULL(DATE_FORMAT(ended_at,'%Y-%m'),''),
		display_order, is_published FROM projects WHERE slug=?`, slug)
	p, err := scanProject(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *mysqlRepo) ProjectByID(ctx context.Context, id string) (*model.Project, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, slug, kind, title_zh, title_en, tagline_zh, tagline_en, summary_zh, summary_en,
		tags, highlights, COALESCE(link,''), COALESCE(repo,''), COALESCE(cover_url,''),
		DATE_FORMAT(started_at,'%Y-%m'), IFNULL(DATE_FORMAT(ended_at,'%Y-%m'),''),
		display_order, is_published FROM projects WHERE id=?`, id)
	p, err := scanProject(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *mysqlRepo) UpsertProject(ctx context.Context, p model.Project) (model.Project, error) {
	return p, upsertProjectTx(ctx, r.db, p)
}

func (r *mysqlRepo) DeleteProject(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM projects WHERE id=?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *mysqlRepo) Experiences(ctx context.Context, includeDrafts bool) ([]model.Experience, error) {
	q := `SELECT id, slug, org_zh, org_en, role_zh, role_en, summary_zh, summary_en, metrics,
		COALESCE(link,''), DATE_FORMAT(started_at,'%Y-%m'), IFNULL(DATE_FORMAT(ended_at,'%Y-%m'),''),
		display_order, is_published FROM experiences`
	if !includeDrafts {
		q += ` WHERE is_published=1`
	}
	q += ` ORDER BY display_order DESC, started_at DESC`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Experience
	for rows.Next() {
		e, err := scanExperience(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *mysqlRepo) ExperienceBySlug(ctx context.Context, slug string) (*model.Experience, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, slug, org_zh, org_en, role_zh, role_en, summary_zh, summary_en, metrics,
		COALESCE(link,''), DATE_FORMAT(started_at,'%Y-%m'), IFNULL(DATE_FORMAT(ended_at,'%Y-%m'),''),
		display_order, is_published FROM experiences WHERE slug=?`, slug)
	e, err := scanExperience(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &e, nil
}

func (r *mysqlRepo) ExperienceByID(ctx context.Context, id string) (*model.Experience, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, slug, org_zh, org_en, role_zh, role_en, summary_zh, summary_en, metrics,
		COALESCE(link,''), DATE_FORMAT(started_at,'%Y-%m'), IFNULL(DATE_FORMAT(ended_at,'%Y-%m'),''),
		display_order, is_published FROM experiences WHERE id=?`, id)
	e, err := scanExperience(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &e, nil
}

func (r *mysqlRepo) UpsertExperience(ctx context.Context, e model.Experience) (model.Experience, error) {
	return e, upsertExperienceTx(ctx, r.db, e)
}

func (r *mysqlRepo) DeleteExperience(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM experiences WHERE id=?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *mysqlRepo) Honors(ctx context.Context, includeDrafts bool) ([]model.Honor, error) {
	q := `SELECT id, pillar, title_zh, title_en, story_zh, story_en, display_order, is_published FROM honors`
	if !includeDrafts {
		q += ` WHERE is_published=1`
	}
	q += ` ORDER BY display_order DESC`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Honor
	for rows.Next() {
		h, err := scanHonor(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (r *mysqlRepo) HonorByID(ctx context.Context, id string) (*model.Honor, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, pillar, title_zh, title_en, story_zh, story_en, display_order, is_published
		FROM honors WHERE id=?`, id)
	h, err := scanHonor(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &h, nil
}

func (r *mysqlRepo) UpsertHonor(ctx context.Context, h model.Honor) (model.Honor, error) {
	return h, upsertHonorTx(ctx, r.db, h)
}

func (r *mysqlRepo) DeleteHonor(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM honors WHERE id=?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *mysqlRepo) Education(ctx context.Context) ([]model.Education, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, school_zh, school_en, degree_zh, degree_en, COALESCE(notes_zh,''), COALESCE(notes_en,''),
		DATE_FORMAT(started_at,'%Y-%m'), IFNULL(DATE_FORMAT(ended_at,'%Y-%m'),''), display_order
		FROM education ORDER BY display_order DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Education
	for rows.Next() {
		var e model.Education
		if err := rows.Scan(&e.ID, &e.School.ZH, &e.School.EN, &e.Degree.ZH, &e.Degree.EN,
			&e.Notes.ZH, &e.Notes.EN, &e.StartedAt, &e.EndedAt, &e.DisplayOrder); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *mysqlRepo) EducationByID(ctx context.Context, id string) (*model.Education, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, school_zh, school_en, degree_zh, degree_en, COALESCE(notes_zh,''), COALESCE(notes_en,''),
		DATE_FORMAT(started_at,'%Y-%m'), IFNULL(DATE_FORMAT(ended_at,'%Y-%m'),''), display_order
		FROM education WHERE id=?`, id)
	var e model.Education
	if err := row.Scan(&e.ID, &e.School.ZH, &e.School.EN, &e.Degree.ZH, &e.Degree.EN,
		&e.Notes.ZH, &e.Notes.EN, &e.StartedAt, &e.EndedAt, &e.DisplayOrder); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &e, nil
}

func (r *mysqlRepo) UpsertEducation(ctx context.Context, e model.Education) (model.Education, error) {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO education (id, school_zh, school_en, degree_zh, degree_en, notes_zh, notes_en,
			started_at, ended_at, display_order)
		VALUES (?,?,?,?,?,?,?,?,?,?)
		ON DUPLICATE KEY UPDATE school_zh=VALUES(school_zh), school_en=VALUES(school_en),
			degree_zh=VALUES(degree_zh), degree_en=VALUES(degree_en), notes_zh=VALUES(notes_zh),
			notes_en=VALUES(notes_en), started_at=VALUES(started_at), ended_at=VALUES(ended_at),
			display_order=VALUES(display_order)`,
		e.ID, e.School.ZH, e.School.EN, e.Degree.ZH, e.Degree.EN,
		nullStr(e.Notes.ZH), nullStr(e.Notes.EN),
		parseDate(e.StartedAt), parseDatePtr(e.EndedAt), e.DisplayOrder)
	return e, err
}

func (r *mysqlRepo) DeleteEducation(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM education WHERE id=?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *mysqlRepo) Timeline(ctx context.Context) ([]model.TimelineEvent, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, DATE_FORMAT(date,'%Y-%m'), kind, title_zh, title_en, body_zh, body_en
		FROM timeline ORDER BY date ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.TimelineEvent
	for rows.Next() {
		var t model.TimelineEvent
		if err := rows.Scan(&t.ID, &t.Date, &t.Kind, &t.Title.ZH, &t.Title.EN, &t.Body.ZH, &t.Body.EN); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *mysqlRepo) TimelineByID(ctx context.Context, id string) (*model.TimelineEvent, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, DATE_FORMAT(date,'%Y-%m'), kind, title_zh, title_en, body_zh, body_en
		FROM timeline WHERE id=?`, id)
	var t model.TimelineEvent
	if err := row.Scan(&t.ID, &t.Date, &t.Kind, &t.Title.ZH, &t.Title.EN, &t.Body.ZH, &t.Body.EN); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (r *mysqlRepo) UpsertTimeline(ctx context.Context, t model.TimelineEvent) (model.TimelineEvent, error) {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO timeline (id, date, kind, title_zh, title_en, body_zh, body_en)
		VALUES (?,?,?,?,?,?,?)
		ON DUPLICATE KEY UPDATE date=VALUES(date), kind=VALUES(kind), title_zh=VALUES(title_zh),
			title_en=VALUES(title_en), body_zh=VALUES(body_zh), body_en=VALUES(body_en)`,
		t.ID, parseDate(t.Date), t.Kind, t.Title.ZH, t.Title.EN, t.Body.ZH, t.Body.EN)
	return t, err
}

func (r *mysqlRepo) DeleteTimeline(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM timeline WHERE id=?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *mysqlRepo) GetSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := r.db.QueryRowContext(ctx, `SELECT value FROM site_settings WHERE `+"`key`"+`=?`, key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return value, err
}

func (r *mysqlRepo) SetSetting(ctx context.Context, key, value string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO site_settings (`+"`key`"+`, value, updated_at) VALUES (?,?,?)
		ON DUPLICATE KEY UPDATE value=VALUES(value), updated_at=VALUES(updated_at)`,
		key, value, time.Now().UTC())
	return err
}

type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

type scanner interface {
	Scan(dest ...any) error
}

func upsertProjectTx(ctx context.Context, ex execer, p model.Project) error {
	tags, _ := json.Marshal(p.Tags)
	if tags == nil {
		tags = []byte("[]")
	}
	highlights, _ := json.Marshal(p.Highlights)
	if highlights == nil {
		highlights = []byte("[]")
	}
	_, err := ex.ExecContext(ctx, `
		INSERT INTO projects (id, slug, kind, title_zh, title_en, tagline_zh, tagline_en, summary_zh, summary_en,
			tags, highlights, link, repo, cover_url, started_at, ended_at, display_order, is_published)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
		ON DUPLICATE KEY UPDATE slug=VALUES(slug), kind=VALUES(kind), title_zh=VALUES(title_zh), title_en=VALUES(title_en),
			tagline_zh=VALUES(tagline_zh), tagline_en=VALUES(tagline_en), summary_zh=VALUES(summary_zh), summary_en=VALUES(summary_en),
			tags=VALUES(tags), highlights=VALUES(highlights), link=VALUES(link), repo=VALUES(repo), cover_url=VALUES(cover_url),
			started_at=VALUES(started_at), ended_at=VALUES(ended_at), display_order=VALUES(display_order), is_published=VALUES(is_published)`,
		p.ID, p.Slug, p.Kind, p.Title.ZH, p.Title.EN, p.Tagline.ZH, p.Tagline.EN, p.Summary.ZH, p.Summary.EN,
		tags, highlights, nullStr(p.Link), nullStr(p.Repo), nullStr(p.CoverURL),
		parseDate(p.StartedAt), parseDatePtr(p.EndedAt), p.DisplayOrder, p.IsPublished)
	return err
}

func upsertExperienceTx(ctx context.Context, ex execer, e model.Experience) error {
	metrics, _ := json.Marshal(e.Metrics)
	if metrics == nil {
		metrics = []byte("[]")
	}
	_, err := ex.ExecContext(ctx, `
		INSERT INTO experiences (id, slug, org_zh, org_en, role_zh, role_en, summary_zh, summary_en,
			metrics, link, started_at, ended_at, display_order, is_published)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
		ON DUPLICATE KEY UPDATE slug=VALUES(slug), org_zh=VALUES(org_zh), org_en=VALUES(org_en),
			role_zh=VALUES(role_zh), role_en=VALUES(role_en), summary_zh=VALUES(summary_zh), summary_en=VALUES(summary_en),
			metrics=VALUES(metrics), link=VALUES(link), started_at=VALUES(started_at), ended_at=VALUES(ended_at),
			display_order=VALUES(display_order), is_published=VALUES(is_published)`,
		e.ID, e.Slug, e.Org.ZH, e.Org.EN, e.Role.ZH, e.Role.EN, e.Summary.ZH, e.Summary.EN,
		metrics, nullStr(e.Link), parseDate(e.StartedAt), parseDatePtr(e.EndedAt), e.DisplayOrder, e.IsPublished)
	return err
}

func upsertHonorTx(ctx context.Context, ex execer, h model.Honor) error {
	_, err := ex.ExecContext(ctx, `
		INSERT INTO honors (id, pillar, title_zh, title_en, story_zh, story_en, display_order, is_published)
		VALUES (?,?,?,?,?,?,?,?)
		ON DUPLICATE KEY UPDATE pillar=VALUES(pillar), title_zh=VALUES(title_zh), title_en=VALUES(title_en),
			story_zh=VALUES(story_zh), story_en=VALUES(story_en), display_order=VALUES(display_order),
			is_published=VALUES(is_published)`,
		h.ID, h.Pillar, h.Title.ZH, h.Title.EN, h.Story.ZH, h.Story.EN, h.DisplayOrder, h.IsPublished)
	return err
}

func scanProject(row scanner) (model.Project, error) {
	var p model.Project
	var tags, highlights []byte
	var published int
	if err := row.Scan(&p.ID, &p.Slug, &p.Kind, &p.Title.ZH, &p.Title.EN, &p.Tagline.ZH, &p.Tagline.EN,
		&p.Summary.ZH, &p.Summary.EN, &tags, &highlights, &p.Link, &p.Repo, &p.CoverURL,
		&p.StartedAt, &p.EndedAt, &p.DisplayOrder, &published); err != nil {
		return p, err
	}
	_ = json.Unmarshal(tags, &p.Tags)
	_ = json.Unmarshal(highlights, &p.Highlights)
	if p.Tags == nil {
		p.Tags = []string{}
	}
	if p.Highlights == nil {
		p.Highlights = []model.LocalizedString{}
	}
	p.IsPublished = published == 1
	return p, nil
}

func scanExperience(row scanner) (model.Experience, error) {
	var e model.Experience
	var metrics []byte
	var published int
	if err := row.Scan(&e.ID, &e.Slug, &e.Org.ZH, &e.Org.EN, &e.Role.ZH, &e.Role.EN,
		&e.Summary.ZH, &e.Summary.EN, &metrics, &e.Link, &e.StartedAt, &e.EndedAt,
		&e.DisplayOrder, &published); err != nil {
		return e, err
	}
	_ = json.Unmarshal(metrics, &e.Metrics)
	if e.Metrics == nil {
		e.Metrics = []model.LocalizedString{}
	}
	e.IsPublished = published == 1
	return e, nil
}

func scanHonor(row scanner) (model.Honor, error) {
	var h model.Honor
	var published int
	if err := row.Scan(&h.ID, &h.Pillar, &h.Title.ZH, &h.Title.EN, &h.Story.ZH, &h.Story.EN,
		&h.DisplayOrder, &published); err != nil {
		return h, err
	}
	h.IsPublished = published == 1
	return h, nil
}

func parseDate(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "1970-01-01"
	}
	if len(s) == 7 { // YYYY-MM
		return s + "-01"
	}
	return s
}

func parseDatePtr(s string) any {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return parseDate(s)
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
