package content

import (
	"context"
	"crypto/sha1"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/guts-yang/hello-gutsyang/server/internal/model"
)

var (
	ErrNotFound = errors.New("content: not found")
)

type Repo interface {
	Home(ctx context.Context) (model.HomeContent, error)
	Snapshot(ctx context.Context) (model.ContentSnapshot, error)
	ImportSnapshot(ctx context.Context, snap model.ContentSnapshot) error
	IsEmpty(ctx context.Context) (bool, error)

	Profile(ctx context.Context) (model.Profile, error)
	UpdateProfile(ctx context.Context, next model.Profile) (model.Profile, error)

	Projects(ctx context.Context, includeDrafts bool) ([]model.Project, error)
	ProjectBySlug(ctx context.Context, slug string) (*model.Project, error)
	ProjectByID(ctx context.Context, id string) (*model.Project, error)
	UpsertProject(ctx context.Context, p model.Project) (model.Project, error)
	DeleteProject(ctx context.Context, id string) error

	Experiences(ctx context.Context, includeDrafts bool) ([]model.Experience, error)
	ExperienceBySlug(ctx context.Context, slug string) (*model.Experience, error)
	ExperienceByID(ctx context.Context, id string) (*model.Experience, error)
	UpsertExperience(ctx context.Context, e model.Experience) (model.Experience, error)
	DeleteExperience(ctx context.Context, id string) error

	Honors(ctx context.Context, includeDrafts bool) ([]model.Honor, error)
	HonorByID(ctx context.Context, id string) (*model.Honor, error)
	UpsertHonor(ctx context.Context, h model.Honor) (model.Honor, error)
	DeleteHonor(ctx context.Context, id string) error

	Education(ctx context.Context) ([]model.Education, error)
	EducationByID(ctx context.Context, id string) (*model.Education, error)
	UpsertEducation(ctx context.Context, e model.Education) (model.Education, error)
	DeleteEducation(ctx context.Context, id string) error

	Timeline(ctx context.Context) ([]model.TimelineEvent, error)
	TimelineByID(ctx context.Context, id string) (*model.TimelineEvent, error)
	UpsertTimeline(ctx context.Context, t model.TimelineEvent) (model.TimelineEvent, error)
	DeleteTimeline(ctx context.Context, id string) error

	GetSetting(ctx context.Context, key string) (string, error)
	SetSetting(ctx context.Context, key, value string) error
}

type Service struct{ repo Repo }

func NewService(db *sql.DB) (*Service, error) {
	var repo Repo
	if db != nil {
		repo = &mysqlRepo{db: db}
		empty, err := repo.IsEmpty(context.Background())
		if err != nil {
			return nil, err
		}
		snap, err := LoadEmbeddedSeed()
		if err != nil {
			return nil, err
		}
		if empty {
			if err := repo.ImportSnapshot(context.Background(), snap); err != nil {
				return nil, err
			}
		} else if err := mergeSeed(context.Background(), repo, snap); err != nil {
			return nil, err
		}
	} else {
		snap, err := LoadEmbeddedSeed()
		if err != nil {
			return nil, err
		}
		m := newMemoryRepo()
		if err := m.ImportSnapshot(context.Background(), snap); err != nil {
			return nil, err
		}
		repo = m
	}
	return &Service{repo: repo}, nil
}

// mergeSeed upserts seed entities by ID so existing databases pick up new
// research-plus-docs content without wiping admin customizations outside seed IDs.
func mergeSeed(ctx context.Context, repo Repo, snap model.ContentSnapshot) error {
	profile, err := repo.Profile(ctx)
	if err == nil {
		profile.Name = snap.Profile.Name
		if len(profile.Socials) == 0 {
			profile.Socials = snap.Profile.Socials
		} else {
			// Keep only GitHub on public profile by default when merging.
			filtered := make([]model.SocialLink, 0, len(profile.Socials))
			for _, s := range profile.Socials {
				if strings.EqualFold(s.Type, "github") {
					filtered = append(filtered, s)
				}
			}
			if len(filtered) == 0 {
				filtered = snap.Profile.Socials
			}
			profile.Socials = filtered
		}
		if _, err := repo.UpdateProfile(ctx, profile); err != nil {
			return err
		}
	}
	for _, p := range snap.Projects {
		if _, err := repo.UpsertProject(ctx, p); err != nil {
			return err
		}
	}
	for _, e := range snap.Experiences {
		if _, err := repo.UpsertExperience(ctx, e); err != nil {
			return err
		}
	}
	for _, h := range snap.Honors {
		if _, err := repo.UpsertHonor(ctx, h); err != nil {
			return err
		}
	}
	for _, e := range snap.Education {
		if _, err := repo.UpsertEducation(ctx, e); err != nil {
			return err
		}
	}
	for _, t := range snap.Timeline {
		if _, err := repo.UpsertTimeline(ctx, t); err != nil {
			return err
		}
	}
	return nil
}

func NewMemoryService() (*Service, error) {
	return NewService(nil)
}

func LoadEmbeddedSeed() (model.ContentSnapshot, error) {
	var snap model.ContentSnapshot
	if err := json.Unmarshal(seedJSON, &snap); err != nil {
		return snap, fmt.Errorf("content: seed: %w", err)
	}
	normalizeSnapshot(&snap)
	return snap, nil
}

func normalizeSnapshot(snap *model.ContentSnapshot) {
	if snap.Profile.ID == "" {
		snap.Profile.ID = "main"
	}
	if snap.Profile.UpdatedAt.IsZero() {
		snap.Profile.UpdatedAt = time.Now().UTC()
	}
	for i := range snap.Projects {
		snap.Projects[i].ID = stableEntityUUID("project", snap.Projects[i].ID).String()
		if snap.Projects[i].Tags == nil {
			snap.Projects[i].Tags = []string{}
		}
		if snap.Projects[i].Highlights == nil {
			snap.Projects[i].Highlights = []string{}
		}
	}
	for i := range snap.Experiences {
		snap.Experiences[i].ID = stableEntityUUID("experience", snap.Experiences[i].ID).String()
		if snap.Experiences[i].Metrics == nil {
			snap.Experiences[i].Metrics = []string{}
		}
	}
	for i := range snap.Honors {
		snap.Honors[i].ID = stableEntityUUID("honor", snap.Honors[i].ID).String()
	}
	for i := range snap.Education {
		snap.Education[i].ID = stableEntityUUID("education", snap.Education[i].ID).String()
	}
	for i := range snap.Timeline {
		snap.Timeline[i].ID = stableEntityUUID("timeline", snap.Timeline[i].ID).String()
	}
}

func stableEntityUUID(kind, id string) uuid.UUID {
	if u, err := uuid.Parse(id); err == nil {
		return u
	}
	sum := sha1.Sum([]byte(kind + ":" + id))
	var u uuid.UUID
	copy(u[:], sum[:16])
	u[6] = (u[6] & 0x0f) | 0x50 // version 5-ish
	u[8] = (u[8] & 0x3f) | 0x80
	return u
}

func (s *Service) Home(ctx context.Context) (model.HomeContent, error) {
	home, err := s.repo.Home(ctx)
	if err != nil {
		return home, err
	}
	visuals, err := s.Visuals(ctx)
	if err != nil {
		return home, err
	}
	home.Visuals = visuals
	return home, nil
}
func (s *Service) Snapshot(ctx context.Context) (model.ContentSnapshot, error) {
	return s.repo.Snapshot(ctx)
}
func (s *Service) ImportSnapshot(ctx context.Context, snap model.ContentSnapshot) error {
	normalizeSnapshot(&snap)
	return s.repo.ImportSnapshot(ctx, snap)
}
func (s *Service) Profile(ctx context.Context) (model.Profile, error) {
	return s.repo.Profile(ctx)
}
func (s *Service) UpdateProfile(ctx context.Context, next model.Profile) (model.Profile, error) {
	return s.repo.UpdateProfile(ctx, next)
}
func (s *Service) Projects(ctx context.Context, includeDrafts bool) ([]model.Project, error) {
	return s.repo.Projects(ctx, includeDrafts)
}
func (s *Service) ProjectBySlug(ctx context.Context, slug string) (*model.Project, error) {
	return s.repo.ProjectBySlug(ctx, slug)
}
func (s *Service) ProjectByID(ctx context.Context, id string) (*model.Project, error) {
	return s.repo.ProjectByID(ctx, id)
}
func (s *Service) UpsertProject(ctx context.Context, p model.Project) (model.Project, error) {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return s.repo.UpsertProject(ctx, p)
}
func (s *Service) DeleteProject(ctx context.Context, id string) error {
	return s.repo.DeleteProject(ctx, id)
}
func (s *Service) Experiences(ctx context.Context, includeDrafts bool) ([]model.Experience, error) {
	return s.repo.Experiences(ctx, includeDrafts)
}
func (s *Service) ExperienceBySlug(ctx context.Context, slug string) (*model.Experience, error) {
	return s.repo.ExperienceBySlug(ctx, slug)
}
func (s *Service) ExperienceByID(ctx context.Context, id string) (*model.Experience, error) {
	return s.repo.ExperienceByID(ctx, id)
}
func (s *Service) UpsertExperience(ctx context.Context, e model.Experience) (model.Experience, error) {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	return s.repo.UpsertExperience(ctx, e)
}
func (s *Service) DeleteExperience(ctx context.Context, id string) error {
	return s.repo.DeleteExperience(ctx, id)
}
func (s *Service) Honors(ctx context.Context, includeDrafts bool) ([]model.Honor, error) {
	return s.repo.Honors(ctx, includeDrafts)
}
func (s *Service) HonorByID(ctx context.Context, id string) (*model.Honor, error) {
	return s.repo.HonorByID(ctx, id)
}
func (s *Service) UpsertHonor(ctx context.Context, h model.Honor) (model.Honor, error) {
	if h.ID == "" {
		h.ID = uuid.New().String()
	}
	return s.repo.UpsertHonor(ctx, h)
}
func (s *Service) DeleteHonor(ctx context.Context, id string) error {
	return s.repo.DeleteHonor(ctx, id)
}
func (s *Service) Education(ctx context.Context) ([]model.Education, error) {
	return s.repo.Education(ctx)
}
func (s *Service) EducationByID(ctx context.Context, id string) (*model.Education, error) {
	return s.repo.EducationByID(ctx, id)
}
func (s *Service) UpsertEducation(ctx context.Context, e model.Education) (model.Education, error) {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	return s.repo.UpsertEducation(ctx, e)
}
func (s *Service) DeleteEducation(ctx context.Context, id string) error {
	return s.repo.DeleteEducation(ctx, id)
}
func (s *Service) Timeline(ctx context.Context) ([]model.TimelineEvent, error) {
	return s.repo.Timeline(ctx)
}
func (s *Service) TimelineByID(ctx context.Context, id string) (*model.TimelineEvent, error) {
	return s.repo.TimelineByID(ctx, id)
}
func (s *Service) UpsertTimeline(ctx context.Context, t model.TimelineEvent) (model.TimelineEvent, error) {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return s.repo.UpsertTimeline(ctx, t)
}
func (s *Service) DeleteTimeline(ctx context.Context, id string) error {
	return s.repo.DeleteTimeline(ctx, id)
}

const (
	SettingResumeURL   = "resume_url"
	SettingHomeVisuals = "home_visuals"
)

// DefaultVisuals returns the visual assets bundled with the embedded seed.
func DefaultVisuals() model.VisualSettings {
	return model.VisualSettings{
		HeroVideoURL:          "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4",
		FeatureVideoURL:       "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_133058_0504132a-0cf3-4450-a370-8ea3b05c95d4.mp4",
		FeatureIconProjects:   "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171918_4a5edc79-d78f-4637-ac8b-53c43c220606.png&w=1280&q=85",
		FeatureIconExperience: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171741_ed9845ab-f5b2-4018-8ce7-07cc01823522.png&w=1280&q=85",
		FeatureIconEducation:  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171809_f56666dc-c099-4778-ad82-9ad4f209567b.png&w=1280&q=85",
	}
}

func (s *Service) Visuals(ctx context.Context) (model.VisualSettings, error) {
	raw, err := s.repo.GetSetting(ctx, SettingHomeVisuals)
	if errors.Is(err, ErrNotFound) || strings.TrimSpace(raw) == "" {
		return DefaultVisuals(), nil
	}
	if err != nil {
		return model.VisualSettings{}, err
	}
	var visuals model.VisualSettings
	if err := json.Unmarshal([]byte(raw), &visuals); err != nil {
		return DefaultVisuals(), nil
	}
	if visuals == (model.VisualSettings{}) {
		return DefaultVisuals(), nil
	}
	return visuals, nil
}

func (s *Service) SetVisuals(ctx context.Context, visuals model.VisualSettings) (model.VisualSettings, error) {
	visuals.UpdatedAt = time.Now().UTC()
	raw, err := json.Marshal(visuals)
	if err != nil {
		return model.VisualSettings{}, err
	}
	if err := s.repo.SetSetting(ctx, SettingHomeVisuals, string(raw)); err != nil {
		return model.VisualSettings{}, err
	}
	return visuals, nil
}

func (s *Service) Resume(ctx context.Context) (model.ResumeSettings, error) {
	url, err := s.repo.GetSetting(ctx, SettingResumeURL)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return model.ResumeSettings{}, err
	}
	return model.ResumeSettings{URL: url, Available: strings.TrimSpace(url) != ""}, nil
}

func (s *Service) SetResumeURL(ctx context.Context, url string) (model.ResumeSettings, error) {
	url = strings.TrimSpace(url)
	if err := s.repo.SetSetting(ctx, SettingResumeURL, url); err != nil {
		return model.ResumeSettings{}, err
	}
	return model.ResumeSettings{URL: url, Available: url != "", UpdatedAt: time.Now().UTC()}, nil
}

func (s *Service) Stats(ctx context.Context) (map[string]int, error) {
	projects, err := s.Projects(ctx, true)
	if err != nil {
		return nil, err
	}
	experiences, err := s.Experiences(ctx, true)
	if err != nil {
		return nil, err
	}
	honors, err := s.Honors(ctx, true)
	if err != nil {
		return nil, err
	}
	education, err := s.Education(ctx)
	if err != nil {
		return nil, err
	}
	timeline, err := s.Timeline(ctx)
	if err != nil {
		return nil, err
	}
	resume, err := s.Resume(ctx)
	if err != nil {
		return nil, err
	}
	resumeCount := 0
	if resume.Available {
		resumeCount = 1
	}
	return map[string]int{
		"projects":    len(projects),
		"experiences": len(experiences),
		"honors":      len(honors),
		"education":   len(education),
		"timeline":    len(timeline),
		"resume":      resumeCount,
	}, nil
}

func (s *Service) SearchProjects(ctx context.Context, query string, limit int) ([]model.Project, error) {
	all, err := s.Projects(ctx, false)
	if err != nil {
		return nil, err
	}
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" {
		if limit > 0 && len(all) > limit {
			return all[:limit], nil
		}
		return all, nil
	}
	var hits []model.Project
	for _, p := range all {
		blob := strings.ToLower(strings.Join([]string{
			p.Slug, p.Title, p.Tagline, p.Summary, strings.Join(p.Tags, " "),
		}, " "))
		if strings.Contains(blob, q) {
			hits = append(hits, p)
			if limit > 0 && len(hits) >= limit {
				break
			}
		}
	}
	return hits, nil
}

// --- memory repo ---

type memoryRepo struct {
	mu       sync.RWMutex
	snap     model.ContentSnapshot
	settings map[string]string
}

func newMemoryRepo() *memoryRepo {
	return &memoryRepo{
		snap: model.ContentSnapshot{
			Projects:    []model.Project{},
			Experiences: []model.Experience{},
			Honors:      []model.Honor{},
			Education:   []model.Education{},
			Timeline:    []model.TimelineEvent{},
		},
		settings: map[string]string{},
	}
}

func (r *memoryRepo) IsEmpty(_ context.Context) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.snap.Profile.Name == "", nil
}

func (r *memoryRepo) ImportSnapshot(_ context.Context, snap model.ContentSnapshot) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.snap = snap
	return nil
}

func (r *memoryRepo) Snapshot(_ context.Context) (model.ContentSnapshot, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return cloneSnap(r.snap), nil
}

func (r *memoryRepo) Home(ctx context.Context) (model.HomeContent, error) {
	snap, err := r.Snapshot(ctx)
	if err != nil {
		return model.HomeContent{}, err
	}
	return model.HomeContent{
		Profile:     snap.Profile,
		Projects:    publishedProjects(snap.Projects),
		Experiences: publishedExperiences(snap.Experiences),
		Honors:      publishedHonors(snap.Honors),
		Education:   cloneEducation(snap.Education),
		Timeline:    cloneTimeline(snap.Timeline),
		Visuals:     snap.Visuals,
	}, nil
}

func (r *memoryRepo) Profile(_ context.Context) (model.Profile, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.snap.Profile, nil
}

func (r *memoryRepo) UpdateProfile(_ context.Context, next model.Profile) (model.Profile, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	next.ID = "main"
	next.UpdatedAt = time.Now().UTC()
	r.snap.Profile = next
	return next, nil
}

func (r *memoryRepo) Projects(_ context.Context, includeDrafts bool) ([]model.Project, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if includeDrafts {
		return cloneProjects(r.snap.Projects), nil
	}
	return publishedProjects(r.snap.Projects), nil
}

func (r *memoryRepo) ProjectBySlug(ctx context.Context, slug string) (*model.Project, error) {
	items, _ := r.Projects(ctx, true)
	for i := range items {
		if items[i].Slug == slug {
			p := items[i]
			return &p, nil
		}
	}
	return nil, ErrNotFound
}

func (r *memoryRepo) ProjectByID(_ context.Context, id string) (*model.Project, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for i := range r.snap.Projects {
		if r.snap.Projects[i].ID == id {
			p := r.snap.Projects[i]
			return &p, nil
		}
	}
	return nil, ErrNotFound
}

func (r *memoryRepo) UpsertProject(_ context.Context, p model.Project) (model.Project, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.snap.Projects {
		if r.snap.Projects[i].ID == p.ID {
			r.snap.Projects[i] = p
			return p, nil
		}
	}
	r.snap.Projects = append(r.snap.Projects, p)
	return p, nil
}

func (r *memoryRepo) DeleteProject(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.snap.Projects {
		if r.snap.Projects[i].ID == id {
			r.snap.Projects = append(r.snap.Projects[:i], r.snap.Projects[i+1:]...)
			return nil
		}
	}
	return ErrNotFound
}

func (r *memoryRepo) Experiences(_ context.Context, includeDrafts bool) ([]model.Experience, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if includeDrafts {
		return cloneExperiences(r.snap.Experiences), nil
	}
	return publishedExperiences(r.snap.Experiences), nil
}

func (r *memoryRepo) ExperienceBySlug(ctx context.Context, slug string) (*model.Experience, error) {
	items, _ := r.Experiences(ctx, true)
	for i := range items {
		if items[i].Slug == slug {
			e := items[i]
			return &e, nil
		}
	}
	return nil, ErrNotFound
}

func (r *memoryRepo) ExperienceByID(_ context.Context, id string) (*model.Experience, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for i := range r.snap.Experiences {
		if r.snap.Experiences[i].ID == id {
			e := r.snap.Experiences[i]
			return &e, nil
		}
	}
	return nil, ErrNotFound
}

func (r *memoryRepo) UpsertExperience(_ context.Context, e model.Experience) (model.Experience, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.snap.Experiences {
		if r.snap.Experiences[i].ID == e.ID {
			r.snap.Experiences[i] = e
			return e, nil
		}
	}
	r.snap.Experiences = append(r.snap.Experiences, e)
	return e, nil
}

func (r *memoryRepo) DeleteExperience(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.snap.Experiences {
		if r.snap.Experiences[i].ID == id {
			r.snap.Experiences = append(r.snap.Experiences[:i], r.snap.Experiences[i+1:]...)
			return nil
		}
	}
	return ErrNotFound
}

func (r *memoryRepo) Honors(_ context.Context, includeDrafts bool) ([]model.Honor, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if includeDrafts {
		return cloneHonors(r.snap.Honors), nil
	}
	return publishedHonors(r.snap.Honors), nil
}

func (r *memoryRepo) HonorByID(_ context.Context, id string) (*model.Honor, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for i := range r.snap.Honors {
		if r.snap.Honors[i].ID == id {
			h := r.snap.Honors[i]
			return &h, nil
		}
	}
	return nil, ErrNotFound
}

func (r *memoryRepo) UpsertHonor(_ context.Context, h model.Honor) (model.Honor, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.snap.Honors {
		if r.snap.Honors[i].ID == h.ID {
			r.snap.Honors[i] = h
			return h, nil
		}
	}
	r.snap.Honors = append(r.snap.Honors, h)
	return h, nil
}

func (r *memoryRepo) DeleteHonor(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.snap.Honors {
		if r.snap.Honors[i].ID == id {
			r.snap.Honors = append(r.snap.Honors[:i], r.snap.Honors[i+1:]...)
			return nil
		}
	}
	return ErrNotFound
}

func (r *memoryRepo) Education(_ context.Context) ([]model.Education, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return cloneEducation(r.snap.Education), nil
}

func (r *memoryRepo) EducationByID(_ context.Context, id string) (*model.Education, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for i := range r.snap.Education {
		if r.snap.Education[i].ID == id {
			e := r.snap.Education[i]
			return &e, nil
		}
	}
	return nil, ErrNotFound
}

func (r *memoryRepo) UpsertEducation(_ context.Context, e model.Education) (model.Education, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.snap.Education {
		if r.snap.Education[i].ID == e.ID {
			r.snap.Education[i] = e
			return e, nil
		}
	}
	r.snap.Education = append(r.snap.Education, e)
	return e, nil
}

func (r *memoryRepo) DeleteEducation(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.snap.Education {
		if r.snap.Education[i].ID == id {
			r.snap.Education = append(r.snap.Education[:i], r.snap.Education[i+1:]...)
			return nil
		}
	}
	return ErrNotFound
}

func (r *memoryRepo) Timeline(_ context.Context) ([]model.TimelineEvent, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return cloneTimeline(r.snap.Timeline), nil
}

func (r *memoryRepo) TimelineByID(_ context.Context, id string) (*model.TimelineEvent, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for i := range r.snap.Timeline {
		if r.snap.Timeline[i].ID == id {
			t := r.snap.Timeline[i]
			return &t, nil
		}
	}
	return nil, ErrNotFound
}

func (r *memoryRepo) UpsertTimeline(_ context.Context, t model.TimelineEvent) (model.TimelineEvent, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.snap.Timeline {
		if r.snap.Timeline[i].ID == t.ID {
			r.snap.Timeline[i] = t
			return t, nil
		}
	}
	r.snap.Timeline = append(r.snap.Timeline, t)
	return t, nil
}

func (r *memoryRepo) DeleteTimeline(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.snap.Timeline {
		if r.snap.Timeline[i].ID == id {
			r.snap.Timeline = append(r.snap.Timeline[:i], r.snap.Timeline[i+1:]...)
			return nil
		}
	}
	return ErrNotFound
}

func (r *memoryRepo) GetSetting(_ context.Context, key string) (string, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.settings == nil {
		return "", ErrNotFound
	}
	v, ok := r.settings[key]
	if !ok {
		return "", ErrNotFound
	}
	return v, nil
}

func (r *memoryRepo) SetSetting(_ context.Context, key, value string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.settings == nil {
		r.settings = map[string]string{}
	}
	r.settings[key] = value
	return nil
}

func cloneSnap(s model.ContentSnapshot) model.ContentSnapshot {
	return model.ContentSnapshot{
		Profile:     s.Profile,
		Projects:    cloneProjects(s.Projects),
		Experiences: cloneExperiences(s.Experiences),
		Honors:      cloneHonors(s.Honors),
		Education:   cloneEducation(s.Education),
		Timeline:    cloneTimeline(s.Timeline),
		Visuals:     s.Visuals,
	}
}

func cloneProjects(items []model.Project) []model.Project {
	out := append([]model.Project(nil), items...)
	sortProjects(out)
	return out
}
func publishedProjects(items []model.Project) []model.Project {
	out := make([]model.Project, 0, len(items))
	for _, item := range items {
		if item.IsPublished {
			out = append(out, item)
		}
	}
	sortProjects(out)
	return out
}
func sortProjects(items []model.Project) {
	slices.SortFunc(items, func(a, b model.Project) int {
		if a.DisplayOrder != b.DisplayOrder {
			return b.DisplayOrder - a.DisplayOrder
		}
		return strings.Compare(b.StartedAt, a.StartedAt)
	})
}
func cloneExperiences(items []model.Experience) []model.Experience {
	out := append([]model.Experience(nil), items...)
	sortExperiences(out)
	return out
}
func publishedExperiences(items []model.Experience) []model.Experience {
	out := make([]model.Experience, 0, len(items))
	for _, item := range items {
		if item.IsPublished {
			out = append(out, item)
		}
	}
	sortExperiences(out)
	return out
}
func sortExperiences(items []model.Experience) {
	slices.SortFunc(items, func(a, b model.Experience) int {
		if a.DisplayOrder != b.DisplayOrder {
			return b.DisplayOrder - a.DisplayOrder
		}
		return strings.Compare(b.StartedAt, a.StartedAt)
	})
}
func cloneHonors(items []model.Honor) []model.Honor {
	out := append([]model.Honor(nil), items...)
	sortHonors(out)
	return out
}
func publishedHonors(items []model.Honor) []model.Honor {
	out := make([]model.Honor, 0, len(items))
	for _, item := range items {
		if item.IsPublished {
			out = append(out, item)
		}
	}
	sortHonors(out)
	return out
}
func sortHonors(items []model.Honor) {
	slices.SortFunc(items, func(a, b model.Honor) int { return b.DisplayOrder - a.DisplayOrder })
}
func cloneEducation(items []model.Education) []model.Education {
	out := append([]model.Education(nil), items...)
	slices.SortFunc(out, func(a, b model.Education) int { return b.DisplayOrder - a.DisplayOrder })
	return out
}
func cloneTimeline(items []model.TimelineEvent) []model.TimelineEvent {
	out := append([]model.TimelineEvent(nil), items...)
	slices.SortFunc(out, func(a, b model.TimelineEvent) int { return strings.Compare(a.Date, b.Date) })
	return out
}
