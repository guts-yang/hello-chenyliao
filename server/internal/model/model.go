package model

import "time"

type Locale string

const (
	LocaleZH Locale = "zh"
	LocaleEN Locale = "en"
)

type LocalizedString struct {
	ZH string `json:"zh"`
	EN string `json:"en"`
}

type SocialLink struct {
	Type  string `json:"type"`
	Href  string `json:"href"`
	Label string `json:"label,omitempty"`
}

type Project struct {
	ID           string            `json:"id"`
	Slug         string            `json:"slug"`
	Kind         string            `json:"kind"`
	Title        LocalizedString   `json:"title"`
	Tagline      LocalizedString   `json:"tagline"`
	Summary      LocalizedString   `json:"summary"`
	Tags         []string          `json:"tags"`
	Highlights   []LocalizedString `json:"highlights"`
	Link         string            `json:"link,omitempty"`
	Repo         string            `json:"repo,omitempty"`
	CoverURL     string            `json:"coverUrl,omitempty"`
	StartedAt    string            `json:"startedAt"`
	EndedAt      string            `json:"endedAt,omitempty"`
	DisplayOrder int               `json:"displayOrder"`
	IsPublished  bool              `json:"isPublished"`
}

type Experience struct {
	ID           string            `json:"id"`
	Slug         string            `json:"slug"`
	Org          LocalizedString   `json:"org"`
	Role         LocalizedString   `json:"role"`
	Summary      LocalizedString   `json:"summary"`
	Metrics      []LocalizedString `json:"metrics"`
	Link         string            `json:"link,omitempty"`
	StartedAt    string            `json:"startedAt"`
	EndedAt      string            `json:"endedAt,omitempty"`
	DisplayOrder int               `json:"displayOrder"`
	IsPublished  bool              `json:"isPublished"`
}

type Honor struct {
	ID           string          `json:"id"`
	Pillar       string          `json:"pillar"`
	Title        LocalizedString `json:"title"`
	Story        LocalizedString `json:"story"`
	DisplayOrder int             `json:"displayOrder"`
	IsPublished  bool            `json:"isPublished"`
}

type Education struct {
	ID           string          `json:"id"`
	School       LocalizedString `json:"school"`
	Degree       LocalizedString `json:"degree"`
	Notes        LocalizedString `json:"notes,omitempty"`
	StartedAt    string          `json:"startedAt"`
	EndedAt      string          `json:"endedAt,omitempty"`
	DisplayOrder int             `json:"displayOrder"`
}

type TimelineEvent struct {
	ID    string          `json:"id"`
	Date  string          `json:"date"`
	Kind  string          `json:"kind"`
	Title LocalizedString `json:"title"`
	Body  LocalizedString `json:"body"`
}

type Profile struct {
	ID        string          `json:"id"`
	NameZH    string          `json:"nameZh"`
	NameEN    string          `json:"nameEn"`
	Handle    string          `json:"handle"`
	Role      LocalizedString `json:"role"`
	Slogan    LocalizedString `json:"slogan"`
	Bio       LocalizedString `json:"bio"`
	AvatarURL string          `json:"avatarUrl,omitempty"`
	Socials   []SocialLink    `json:"socials"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

type HomeContent struct {
	Profile     Profile         `json:"profile"`
	Projects    []Project       `json:"projects"`
	Experiences []Experience    `json:"experiences"`
	Honors      []Honor         `json:"honors"`
	Education   []Education     `json:"education"`
	Timeline    []TimelineEvent `json:"timeline"`
}

type ContentSnapshot struct {
	Profile     Profile         `json:"profile"`
	Projects    []Project       `json:"projects"`
	Experiences []Experience    `json:"experiences"`
	Honors      []Honor         `json:"honors"`
	Education   []Education     `json:"education"`
	Timeline    []TimelineEvent `json:"timeline"`
}

type User struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type Session struct {
	Token     string    `json:"token"`
	User      User      `json:"user"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type SessionResponse struct {
	Authenticated bool  `json:"authenticated"`
	User          *User `json:"user,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message,omitempty"`
	User    *User  `json:"user,omitempty"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type ChangeEmailRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewEmail        string `json:"newEmail"`
}

type AdminSessionListItem struct {
	ID         string    `json:"id"`
	IP         string    `json:"ip,omitempty"`
	UserAgent  string    `json:"userAgent,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	LastSeenAt time.Time `json:"lastSeenAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
	Current    bool      `json:"current"`
}

type AdminAuditItem struct {
	ID        string         `json:"id"`
	Action    string         `json:"action"`
	Target    string         `json:"target,omitempty"`
	IP        string         `json:"ip,omitempty"`
	UserAgent string         `json:"userAgent,omitempty"`
	Meta      map[string]any `json:"meta,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
}

type ChatSessionItem struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Locale    string    `json:"locale"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ChatMessageItem struct {
	ID        string    `json:"id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

type MediaUploadRequest struct {
	FileName string `json:"fileName"`
	Folder   string `json:"folder"`
}

type MediaUploadResponse struct {
	UploadURL string `json:"uploadUrl"`
	PublicURL string `json:"publicUrl"`
	Pathname  string `json:"pathname,omitempty"`
}

type ResumeSettings struct {
	URL       string    `json:"url"`
	UpdatedAt time.Time `json:"updatedAt,omitempty"`
	Available bool      `json:"available"`
}
