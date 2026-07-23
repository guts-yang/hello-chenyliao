package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/guts-yang/hello-gutsyang/server/internal/ai"
	"github.com/guts-yang/hello-gutsyang/server/internal/audit"
	"github.com/guts-yang/hello-gutsyang/server/internal/auth"
	"github.com/guts-yang/hello-gutsyang/server/internal/chat"
	"github.com/guts-yang/hello-gutsyang/server/internal/config"
	"github.com/guts-yang/hello-gutsyang/server/internal/content"
	"github.com/guts-yang/hello-gutsyang/server/internal/media"
	"github.com/guts-yang/hello-gutsyang/server/internal/model"
	"github.com/guts-yang/hello-gutsyang/server/internal/platform/cache"
	"github.com/guts-yang/hello-gutsyang/server/internal/platform/db"
	"github.com/guts-yang/hello-gutsyang/server/internal/platform/httpx"
	"github.com/guts-yang/hello-gutsyang/server/internal/platform/objectstore"
	"github.com/guts-yang/hello-gutsyang/server/internal/platform/ratelimit"
	"github.com/guts-yang/hello-gutsyang/server/internal/platform/redisx"
	"github.com/guts-yang/hello-gutsyang/server/migrations"
)

type Server struct {
	cfg          config.Config
	sqlDB        *sql.DB
	redis        *redis.Client
	auth         *auth.Service
	audit        *audit.Service
	content      *content.Service
	chat         chat.Repo
	ai           *ai.Service
	media        *media.Service
	store        objectstore.Store
	cache        cache.Store
	loginLimiter ratelimit.Limiter
	chatLimiter  ratelimit.Limiter
	aiListLimit  ratelimit.Limiter
	adminAILimit ratelimit.Limiter
	databaseOK   bool
}

func New(ctx context.Context, cfg config.Config) (*Server, error) {
	s := &Server{cfg: cfg}

	var sqlDB *sql.DB
	if cfg.DatabaseDSN != "" {
		opened, err := db.Open(ctx, cfg.DatabaseDSN)
		if err != nil {
			log.Printf("[warn] database unavailable, using memory fallbacks: %v", err)
		} else {
			sqlDB = opened
			s.databaseOK = true
			if _, err := db.Up(ctx, sqlDB, migrations.FS); err != nil {
				log.Printf("[warn] migrate: %v", err)
			}
		}
	}
	s.sqlDB = sqlDB

	rdb, err := redisx.Open(ctx, cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	if err != nil {
		log.Printf("[warn] redis unavailable, using in-memory rate limit/cache: %v", err)
		rdb = nil
	}
	s.redis = rdb
	s.cache = redisx.NewCacheOrMemory(rdb)
	s.loginLimiter = redisx.NewLimiterOrMemory(rdb, cfg.RateLimitLogin.Burst, cfg.RateLimitLogin.Window)
	s.chatLimiter = redisx.NewLimiterOrMemory(rdb, cfg.RateLimitChat.Burst, cfg.RateLimitChat.Window)
	s.aiListLimit = redisx.NewLimiterOrMemory(rdb, cfg.RateLimitAIList.Burst, cfg.RateLimitAIList.Window)
	s.adminAILimit = redisx.NewLimiterOrMemory(rdb, cfg.RateLimitAdminAI.Burst, cfg.RateLimitAdminAI.Window)

	var users auth.UserRepo
	var sessions auth.SessionRepo
	var attempts auth.LoginAttemptRepo
	var mode auth.Mode
	if sqlDB != nil {
		users = auth.NewMySQLUserRepo(sqlDB)
		sessions = auth.NewMySQLSessionRepo(sqlDB)
		attempts = auth.NewMySQLAttemptRepo(sqlDB)
		mode = auth.ModeMySQL
		s.audit = audit.NewService(audit.NewMySQLRepo(sqlDB))
	} else {
		users = auth.NewMemoryUserRepo()
		sessions = auth.NewMemorySessionRepo()
		attempts = auth.NewMemoryAttemptRepo()
		mode = auth.ModeMemory
		s.audit = audit.NewService(audit.NewMemoryRepo())
	}
	boot, err := auth.Bootstrap(ctx, users, auth.BootstrapInput{
		Email: cfg.AdminEmail, PasswordHash: cfg.AdminPasswordHash, PasswordPlain: cfg.AdminPassword,
	}, mode)
	if err != nil {
		return nil, err
	}
	s.auth = auth.New(users, sessions, boot.Mode, auth.Options{
		Attempts: attempts,
		Lockout: auth.LockoutConfig{
			Threshold: cfg.LoginLockout.Threshold,
			Window:    cfg.LoginLockout.Window,
			BlockFor:  cfg.LoginLockout.BlockFor,
		},
	})

	cms, err := content.NewService(sqlDB)
	if err != nil {
		return nil, err
	}
	s.content = cms
	s.chat = chat.NewRepo(sqlDB)
	s.ai = ai.NewService(cms, cfg.DeepSeekAPIKey, cfg.DeepSeekBaseURL, cfg.DeepSeekModel)

	localDir := cfg.MediaLocalDir
	if !filepath.IsAbs(localDir) {
		localDir, _ = filepath.Abs(localDir)
	}
	_ = os.MkdirAll(localDir, 0o755)

	var store objectstore.Store
	switch strings.ToLower(cfg.MediaProvider) {
	case "s3":
		s3store, err := objectstore.NewS3(os.Getenv("S3_BUCKET"), os.Getenv("S3_REGION"), os.Getenv("S3_ENDPOINT"))
		if err != nil {
			log.Printf("[warn] s3 store unavailable, falling back to local: %v", err)
			local, err := objectstore.NewLocal(localDir, cfg.PublicBaseURL)
			if err != nil {
				return nil, err
			}
			store = local
		} else {
			store = s3store
		}
	default:
		local, err := objectstore.NewLocal(localDir, cfg.PublicBaseURL)
		if err != nil {
			return nil, err
		}
		store = local
	}
	s.store = store

	// media.Service stores under dataDir/uploads; use parent of MediaLocalDir when
	// MediaLocalDir already ends with "uploads".
	mediaDataDir := localDir
	if strings.EqualFold(filepath.Base(localDir), "uploads") {
		mediaDataDir = filepath.Dir(localDir)
	}
	mediaSvc, err := media.NewService(ctx, mediaDataDir, cfg.PublicBaseURL)
	if err != nil {
		return nil, err
	}
	s.media = mediaSvc
	return s, nil
}

func (s *Server) Close() {
	if s.sqlDB != nil {
		_ = s.sqlDB.Close()
	}
	if s.redis != nil {
		_ = s.redis.Close()
	}
	if s.media != nil {
		s.media.Stop()
	}
}

func (s *Server) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(s.withLogging)
	r.Use(s.withCORS)
	r.Use(s.withCSRF)

	r.Get("/api/health", s.handleHealth)
	r.Get("/api/resume.pdf", s.handleResume)

	r.Route("/api/public", func(r chi.Router) {
		r.Get("/home", s.handlePublicHome)
		r.Get("/profile", s.handlePublicProfile)
		r.Get("/projects", s.handlePublicProjects)
		r.Get("/projects/{slug}", s.handlePublicProject)
		r.Get("/experiences", s.handlePublicExperiences)
		r.Get("/experiences/{slug}", s.handlePublicExperience)
		r.Get("/honors", s.handlePublicHonors)
		r.Get("/education", s.handlePublicEducation)
		r.Get("/timeline", s.handlePublicTimeline)
	})

	r.With(s.withChatOwner).Post("/api/chat", s.handleChat)
	r.Route("/api/ai", func(r chi.Router) {
		r.Use(s.withChatOwner)
		r.Get("/sessions", s.handleListSessions)
		r.Get("/sessions/{id}", s.handleGetSession)
		r.Delete("/sessions/{id}", s.handleDeleteSession)
	})

	r.Post("/api/admin/login", s.handleLogin)
	r.Post("/api/admin/logout", s.handleLogout)
	r.Get("/api/admin/session", s.handleSession)

	r.Group(func(r chi.Router) {
		r.Use(s.requireAdmin(false))
		r.Get("/api/admin/sessions", s.handleAdminSessions)
		r.Get("/api/admin/audit", s.handleAdminAudit)
		r.Get("/api/admin/stats", s.handleAdminStats)
		r.Get("/api/admin/profile", s.handleAdminGetProfile)
		r.Get("/api/admin/projects", s.handleAdminListProjects)
		r.Get("/api/admin/projects/{id}", s.handleAdminGetProject)
		r.Get("/api/admin/experiences", s.handleAdminListExperiences)
		r.Get("/api/admin/experiences/{id}", s.handleAdminGetExperience)
		r.Get("/api/admin/honors", s.handleAdminListHonors)
		r.Get("/api/admin/honors/{id}", s.handleAdminGetHonor)
		r.Get("/api/admin/education", s.handleAdminListEducation)
		r.Get("/api/admin/education/{id}", s.handleAdminGetEducation)
		r.Get("/api/admin/timeline", s.handleAdminListTimeline)
		r.Get("/api/admin/timeline/{id}", s.handleAdminGetTimeline)
		r.Get("/api/admin/resume", s.handleAdminGetResume)
	})

	r.Group(func(r chi.Router) {
		r.Use(s.requireAdmin(true))
		r.Post("/api/admin/password", s.handleChangePassword)
		r.Put("/api/admin/email", s.handleChangeEmail)
		r.Delete("/api/admin/sessions/{id}", s.handleRevokeSession)
		r.Post("/api/admin/sessions/revoke-all", s.handleRevokeAll)
		r.Put("/api/admin/profile", s.handleAdminPutProfile)
		r.Post("/api/admin/projects", s.handleAdminCreateProject)
		r.Put("/api/admin/projects/{id}", s.handleAdminUpdateProject)
		r.Delete("/api/admin/projects/{id}", s.handleAdminDeleteProject)
		r.Post("/api/admin/experiences", s.handleAdminCreateExperience)
		r.Put("/api/admin/experiences/{id}", s.handleAdminUpdateExperience)
		r.Delete("/api/admin/experiences/{id}", s.handleAdminDeleteExperience)
		r.Post("/api/admin/honors", s.handleAdminCreateHonor)
		r.Put("/api/admin/honors/{id}", s.handleAdminUpdateHonor)
		r.Delete("/api/admin/honors/{id}", s.handleAdminDeleteHonor)
		r.Post("/api/admin/education", s.handleAdminCreateEducation)
		r.Put("/api/admin/education/{id}", s.handleAdminUpdateEducation)
		r.Delete("/api/admin/education/{id}", s.handleAdminDeleteEducation)
		r.Post("/api/admin/timeline", s.handleAdminCreateTimeline)
		r.Put("/api/admin/timeline/{id}", s.handleAdminUpdateTimeline)
		r.Delete("/api/admin/timeline/{id}", s.handleAdminDeleteTimeline)
		r.Put("/api/admin/resume", s.handleAdminPutResume)
		r.Post("/api/admin/ai/translate", s.handleTranslate)
		r.Post("/api/admin/media/upload-url", s.handleUploadURL)
		r.Options("/api/admin/media/upload", s.handleUploadOptions)
		r.Post("/api/admin/media/upload", s.handleUploadPost)
		r.Put("/api/admin/media/upload", s.handleUploadPut)
	})

	// Token-based PUT from older Go clients
	r.Options("/api/admin/media/upload/{token}", s.handleUploadOptions)
	r.Put("/api/admin/media/upload/{token}", s.handleUploadByToken)

	fsRoot := s.cfg.MediaLocalDir
	if s.store != nil && s.store.LocalRoot() != "" {
		fsRoot = s.store.LocalRoot()
	}
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(fsRoot))))

	return r
}

func Run(ctx context.Context, cfg config.Config) error {
	s, err := New(ctx, cfg)
	if err != nil {
		return err
	}
	defer s.Close()

	go func() {
		t := time.NewTicker(time.Hour)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				_, _ = s.auth.PurgeExpired(context.Background())
			}
		}
	}()

	srv := &http.Server{Addr: cfg.Addr, Handler: s.Handler()}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()
	log.Printf("listening on %s (auth=%s demo=%v db=%v)", cfg.Addr, s.auth.GetMode(), s.ai.DemoMode(), s.databaseOK)
	err = srv.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"authConfigured": s.auth.Enabled(),
		"authMode":       string(s.auth.GetMode()),
		"demoMode":       s.ai.DemoMode(),
		"database":       s.databaseOK,
	})
}

func (s *Server) handleResume(w http.ResponseWriter, r *http.Request) {
	resume, err := s.content.Resume(r.Context())
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	if !resume.Available {
		httpx.WriteClientError(w, http.StatusNotFound, "resume not available")
		return
	}
	http.Redirect(w, r, resume.URL, http.StatusFound)
}

func (s *Server) cachedJSON(w http.ResponseWriter, r *http.Request, key string, ttl time.Duration, load func() (any, error)) {
	if raw, ok := s.cache.Get(r.Context(), key); ok {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
		return
	}
	v, err := load()
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	raw, err := json.Marshal(v)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.cache.Set(r.Context(), key, raw, ttl)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func (s *Server) invalidatePublicCache() {
	s.cache.DeletePrefix(context.Background(), "public:")
}

func (s *Server) handlePublicHome(w http.ResponseWriter, r *http.Request) {
	s.cachedJSON(w, r, "public:home", 15*time.Second, func() (any, error) { return s.content.Home(r.Context()) })
}
func (s *Server) handlePublicProfile(w http.ResponseWriter, r *http.Request) {
	s.cachedJSON(w, r, "public:profile", 30*time.Second, func() (any, error) { return s.content.Profile(r.Context()) })
}
func (s *Server) handlePublicProjects(w http.ResponseWriter, r *http.Request) {
	s.cachedJSON(w, r, "public:projects", 30*time.Second, func() (any, error) { return s.content.Projects(r.Context(), false) })
}
func (s *Server) handlePublicProject(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	p, err := s.content.ProjectBySlug(r.Context(), slug)
	if err != nil {
		if errors.Is(err, content.ErrNotFound) {
			httpx.WriteClientError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteServerError(w, r, err)
		return
	}
	if !p.IsPublished {
		httpx.WriteClientError(w, http.StatusNotFound, "not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}
func (s *Server) handlePublicExperiences(w http.ResponseWriter, r *http.Request) {
	s.cachedJSON(w, r, "public:experiences", 30*time.Second, func() (any, error) { return s.content.Experiences(r.Context(), false) })
}
func (s *Server) handlePublicExperience(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	e, err := s.content.ExperienceBySlug(r.Context(), slug)
	if err != nil {
		if errors.Is(err, content.ErrNotFound) {
			httpx.WriteClientError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteServerError(w, r, err)
		return
	}
	if !e.IsPublished {
		httpx.WriteClientError(w, http.StatusNotFound, "not found")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, e)
}
func (s *Server) handlePublicHonors(w http.ResponseWriter, r *http.Request) {
	s.cachedJSON(w, r, "public:honors", 30*time.Second, func() (any, error) { return s.content.Honors(r.Context(), false) })
}
func (s *Server) handlePublicEducation(w http.ResponseWriter, r *http.Request) {
	s.cachedJSON(w, r, "public:education", 30*time.Second, func() (any, error) { return s.content.Education(r.Context()) })
}
func (s *Server) handlePublicTimeline(w http.ResponseWriter, r *http.Request) {
	s.cachedJSON(w, r, "public:timeline", 30*time.Second, func() (any, error) { return s.content.Timeline(r.Context()) })
}

// --- chat ---

type chatOwnerKey struct{}

func (s *Server) withChatOwner(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var owner uuid.UUID
		if c, err := r.Cookie(s.cfg.ChatOwnerCookie); err == nil && c.Value != "" {
			if parsed, e := uuid.Parse(c.Value); e == nil {
				owner = parsed
			}
		}
		if owner == uuid.Nil {
			owner = uuid.New()
			http.SetCookie(w, &http.Cookie{
				Name: s.cfg.ChatOwnerCookie, Value: owner.String(), Path: "/",
				HttpOnly: true, SameSite: http.SameSiteLaxMode,
				Secure: s.cfg.CookieSecure.Resolve(s.cfg.AppOrigin),
				MaxAge: 365 * 24 * 60 * 60,
			})
		}
		ctx := context.WithValue(r.Context(), chatOwnerKey{}, owner)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func chatOwner(ctx context.Context) uuid.UUID {
	if v, ok := ctx.Value(chatOwnerKey{}).(uuid.UUID); ok {
		return v
	}
	return uuid.Nil
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	if !s.loginLimiterAllow(w, s.chatLimiter, "chat:"+httpx.ClientIP(r), s.cfg.RateLimitChat.Window) {
		return
	}
	owner := chatOwner(r.Context())
	var body struct {
		Locale    string       `json:"locale"`
		SessionID string       `json:"sessionId"`
		Messages  []ai.Message `json:"messages"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&body); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	msgs := make([]ai.Message, 0, len(body.Messages))
	for _, m := range body.Messages {
		if m.Role != "system" {
			msgs = append(msgs, m)
		}
	}
	if len(msgs) == 0 {
		http.Error(w, "Empty conversation", http.StatusBadRequest)
		return
	}
	locale := model.LocaleZH
	if body.Locale == "en" {
		locale = model.LocaleEN
	}
	var sid uuid.UUID
	if body.SessionID != "" {
		parsed, err := uuid.Parse(body.SessionID)
		if err != nil {
			httpx.WriteClientError(w, http.StatusBadRequest, "invalid session id")
			return
		}
		sid = parsed
	}
	title := chat.SummarizeTitle(lastUserContent(msgs))
	session, err := s.chat.EnsureSession(r.Context(), owner, sid, title, string(locale))
	if err != nil {
		if errors.Is(err, chat.ErrSessionNotFound) {
			httpx.WriteClientError(w, http.StatusNotFound, "session not found")
			return
		}
		httpx.WriteServerError(w, r, err)
		return
	}
	if u := lastUserContent(msgs); u != "" {
		_ = s.chat.AppendMessage(r.Context(), session.ID, "user", u)
	}

	events, err := s.ai.StreamChat(r.Context(), locale, msgs)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Chat-Session-Id", session.ID.String())
	w.Header().Set("Access-Control-Expose-Headers", "X-Chat-Session-Id")
	w.WriteHeader(http.StatusOK)
	flusher, _ := w.(http.Flusher)
	assistant := ""
	for ev := range events {
		if ev.T == "d" {
			assistant += ev.V
		}
		raw, _ := json.Marshal(ev)
		_, _ = w.Write(append(raw, '\n'))
		if flusher != nil {
			flusher.Flush()
		}
	}
	if assistant != "" {
		_ = s.chat.AppendMessage(r.Context(), session.ID, "assistant", assistant)
	}
}

func lastUserContent(msgs []ai.Message) string {
	for i := len(msgs) - 1; i >= 0; i-- {
		if msgs[i].Role == "user" {
			return msgs[i].Content
		}
	}
	return ""
}

func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	if !s.loginLimiterAllow(w, s.aiListLimit, "ai-list:"+httpx.ClientIP(r), s.cfg.RateLimitAIList.Window) {
		return
	}
	owner := chatOwner(r.Context())
	sessions, err := s.chat.ListSessions(r.Context(), owner)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	out := make([]model.ChatSessionItem, 0, len(sessions))
	for _, sess := range sessions {
		out = append(out, model.ChatSessionItem{
			ID: sess.ID.String(), Title: sess.Title, Locale: sess.Locale,
			CreatedAt: sess.CreatedAt, UpdatedAt: sess.UpdatedAt,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	if !s.loginLimiterAllow(w, s.aiListLimit, "ai-list:"+httpx.ClientIP(r), s.cfg.RateLimitAIList.Window) {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid id")
		return
	}
	msgs, err := s.chat.GetMessages(r.Context(), chatOwner(r.Context()), id)
	if err != nil {
		if errors.Is(err, chat.ErrSessionNotFound) {
			httpx.WriteClientError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteServerError(w, r, err)
		return
	}
	out := make([]model.ChatMessageItem, 0, len(msgs))
	for _, m := range msgs {
		out = append(out, model.ChatMessageItem{
			ID: m.ID.String(), Role: m.Role, Content: m.Content, CreatedAt: m.CreatedAt,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	if !s.loginLimiterAllow(w, s.aiListLimit, "ai-list:"+httpx.ClientIP(r), s.cfg.RateLimitAIList.Window) {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.chat.DeleteSession(r.Context(), chatOwner(r.Context()), id); err != nil {
		if errors.Is(err, chat.ErrSessionNotFound) {
			httpx.WriteClientError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteServerError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) loginLimiterAllow(w http.ResponseWriter, lim ratelimit.Limiter, key string, window time.Duration) bool {
	if lim.Allow(context.Background(), key) {
		return true
	}
	httpx.WriteRateLimited(w, window)
	return false
}
