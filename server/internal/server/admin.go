package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/guts-yang/hello-gutsyang/server/internal/audit"
	"github.com/guts-yang/hello-gutsyang/server/internal/auth"
	"github.com/guts-yang/hello-gutsyang/server/internal/content"
	"github.com/guts-yang/hello-gutsyang/server/internal/model"
	"github.com/guts-yang/hello-gutsyang/server/internal/platform/httpx"
)

type adminCtxKey struct{}

type adminContext struct {
	Session *model.Session
	Record  *auth.SessionRecord
	User    *auth.UserRecord
}

func (s *Server) requireAdmin(csrf bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := ""
			if c, err := r.Cookie(s.cfg.SessionCookie); err == nil {
				token = c.Value
			}
			sess, rec, user, err := s.auth.SessionWithRecord(r.Context(), token)
			if err != nil || sess == nil || user == nil {
				httpx.WriteClientError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if csrf {
				cookieToken := ""
				if c, err := r.Cookie(s.csrfCookieName()); err == nil {
					cookieToken = c.Value
				}
				headerToken := r.Header.Get("X-CSRF-Token")
				if !auth.CompareCSRFTokens(cookieToken, headerToken) {
					httpx.WriteClientError(w, http.StatusForbidden, "invalid csrf token")
					return
				}
			}
			ctx := context.WithValue(r.Context(), adminCtxKey{}, &adminContext{Session: sess, Record: rec, User: user})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func adminFrom(ctx context.Context) *adminContext {
	v, _ := ctx.Value(adminCtxKey{}).(*adminContext)
	return v
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.loginLimiterAllow(w, s.loginLimiter, "login:"+httpx.ClientIP(r), s.cfg.RateLimitLogin.Window) {
		return
	}
	var body model.LoginRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024)).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	ip := httpx.ClientIP(r)
	sess, err := s.auth.Login(r.Context(), body.Email, body.Password, ip, r.UserAgent())
	if err != nil {
		if auth.IsLockedOut(err) {
			httpx.WriteRateLimited(w, s.cfg.LoginLockout.BlockFor)
			s.audit.Record(r.Context(), audit.Entry{Action: "login.locked", IP: ip, UserAgent: r.UserAgent()})
			return
		}
		httpx.WriteClientError(w, http.StatusUnauthorized, "invalid email or password")
		s.audit.Record(r.Context(), audit.Entry{Action: "login.failure", IP: ip, UserAgent: r.UserAgent(), Target: strings.ToLower(body.Email)})
		return
	}
	csrf, err := auth.NewCSRFToken()
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	http.SetCookie(w, s.buildSessionCookie(sess.Token, sess.ExpiresAt))
	http.SetCookie(w, s.buildCSRFCookie(csrf, sess.ExpiresAt))
	s.audit.Record(r.Context(), audit.Entry{Action: "login.success", IP: ip, UserAgent: r.UserAgent(), Target: sess.User.Email})
	httpx.WriteJSON(w, http.StatusOK, model.LoginResponse{OK: true, User: &sess.User})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	token := ""
	if c, err := r.Cookie(s.cfg.SessionCookie); err == nil {
		token = c.Value
	}
	_ = s.auth.Logout(r.Context(), token)
	s.clearAuthCookies(w)
	s.audit.Record(r.Context(), audit.Entry{Action: "logout", IP: httpx.ClientIP(r), UserAgent: r.UserAgent()})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	token := ""
	if c, err := r.Cookie(s.cfg.SessionCookie); err == nil {
		token = c.Value
	}
	sess, err := s.auth.Session(r.Context(), token)
	if err != nil || sess == nil {
		httpx.WriteJSON(w, http.StatusOK, model.SessionResponse{Authenticated: false})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, model.SessionResponse{Authenticated: true, User: &sess.User})
}

func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	token := ""
	if c, err := r.Cookie(s.cfg.SessionCookie); err == nil {
		token = c.Value
	}
	if err := s.auth.ChangePassword(r.Context(), ac.User.ID, body.CurrentPassword, body.NewPassword, token); err != nil {
		if auth.IsInvalidCredentials(err) {
			httpx.WriteClientError(w, http.StatusUnauthorized, "invalid email or password")
			return
		}
		httpx.WriteClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.audit.Record(r.Context(), audit.Entry{Action: "password.change", UserID: &ac.User.ID, IP: httpx.ClientIP(r)})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleChangeEmail(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.ChangeEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := s.auth.ChangeEmail(r.Context(), ac.User.ID, body.CurrentPassword, body.NewEmail); err != nil {
		if errors.Is(err, auth.ErrEmailTaken) {
			httpx.WriteClientError(w, http.StatusConflict, "email already in use")
			return
		}
		if auth.IsInvalidCredentials(err) {
			httpx.WriteClientError(w, http.StatusUnauthorized, "invalid email or password")
			return
		}
		if auth.IsInvalidEmail(err) {
			httpx.WriteClientError(w, http.StatusBadRequest, "invalid email")
			return
		}
		httpx.WriteServerError(w, r, err)
		return
	}
	s.audit.Record(r.Context(), audit.Entry{Action: "email.change", UserID: &ac.User.ID, Target: body.NewEmail, IP: httpx.ClientIP(r)})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminSessions(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	items, err := s.auth.ListSessions(r.Context(), ac.User.ID)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	out := make([]model.AdminSessionListItem, 0, len(items))
	currentID := uuid.Nil
	if ac.Record != nil {
		currentID = ac.Record.ID
	}
	for _, it := range items {
		out = append(out, model.AdminSessionListItem{
			ID: it.ID.String(), IP: it.IP, UserAgent: it.UserAgent,
			CreatedAt: it.CreatedAt, LastSeenAt: it.LastSeenAt, ExpiresAt: it.ExpiresAt,
			Current: it.ID == currentID,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) handleRevokeSession(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if ac.Record != nil && ac.Record.ID == id {
		httpx.WriteClientError(w, http.StatusBadRequest, "cannot revoke current session")
		return
	}
	if err := s.auth.RevokeSession(r.Context(), ac.User.ID, id); err != nil {
		if errors.Is(err, auth.ErrSessionNotFound) {
			httpx.WriteClientError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteServerError(w, r, err)
		return
	}
	s.audit.Record(r.Context(), audit.Entry{Action: "session.revoke", UserID: &ac.User.ID, Target: id.String()})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleRevokeAll(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	token := ""
	if c, err := r.Cookie(s.cfg.SessionCookie); err == nil {
		token = c.Value
	}
	n, err := s.auth.RevokeOtherSessions(r.Context(), ac.User.ID, token)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.audit.Record(r.Context(), audit.Entry{Action: "session.revoke_all", UserID: &ac.User.ID})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "revoked": n})
}

func (s *Server) handleAdminAudit(w http.ResponseWriter, r *http.Request) {
	f := audit.ListFilter{Action: r.URL.Query().Get("action"), Limit: 50}
	if before := r.URL.Query().Get("before"); before != "" {
		if t, err := time.Parse(time.RFC3339, before); err == nil {
			f.Before = t
		}
	}
	entries, err := s.audit.List(r.Context(), f)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	out := make([]model.AdminAuditItem, 0, len(entries))
	for _, e := range entries {
		out = append(out, model.AdminAuditItem{
			ID: e.ID.String(), Action: e.Action, Target: e.Target,
			IP: e.IP, UserAgent: e.UserAgent, Meta: e.Meta, CreatedAt: e.CreatedAt,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) handleAdminStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.content.Stats(r.Context())
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, stats)
}

func (s *Server) handleAdminGetProfile(w http.ResponseWriter, r *http.Request) {
	p, err := s.content.Profile(r.Context())
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

func (s *Server) handleAdminPutProfile(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.Profile
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	p, err := s.content.UpdateProfile(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "profile.update", UserID: &ac.User.ID})
	httpx.WriteJSON(w, http.StatusOK, p)
}

func (s *Server) handleAdminGetVisuals(w http.ResponseWriter, r *http.Request) {
	visuals, err := s.content.Visuals(r.Context())
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, visuals)
}

func (s *Server) handleAdminPutVisuals(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.VisualSettings
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	visuals, err := s.content.SetVisuals(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "visuals.update", UserID: &ac.User.ID})
	httpx.WriteJSON(w, http.StatusOK, visuals)
}

func (s *Server) handleAdminListProjects(w http.ResponseWriter, r *http.Request) {
	items, err := s.content.Projects(r.Context(), true)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (s *Server) handleAdminGetProject(w http.ResponseWriter, r *http.Request) {
	p, err := s.content.ProjectByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeContentErr(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

func (s *Server) handleAdminCreateProject(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.Project
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	p, err := s.content.UpsertProject(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "project.create", UserID: &ac.User.ID, Target: p.ID})
	httpx.WriteJSON(w, http.StatusOK, p)
}

func (s *Server) handleAdminUpdateProject(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.Project
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	body.ID = chi.URLParam(r, "id")
	p, err := s.content.UpsertProject(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "project.update", UserID: &ac.User.ID, Target: p.ID})
	httpx.WriteJSON(w, http.StatusOK, p)
}

func (s *Server) handleAdminDeleteProject(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	id := chi.URLParam(r, "id")
	if err := s.content.DeleteProject(r.Context(), id); err != nil {
		writeContentErr(w, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "project.delete", UserID: &ac.User.ID, Target: id})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminListExperiences(w http.ResponseWriter, r *http.Request) {
	items, err := s.content.Experiences(r.Context(), true)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (s *Server) handleAdminGetExperience(w http.ResponseWriter, r *http.Request) {
	e, err := s.content.ExperienceByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeContentErr(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, e)
}

func (s *Server) handleAdminCreateExperience(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.Experience
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	e, err := s.content.UpsertExperience(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "experience.create", UserID: &ac.User.ID, Target: e.ID})
	httpx.WriteJSON(w, http.StatusOK, e)
}

func (s *Server) handleAdminUpdateExperience(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.Experience
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	body.ID = chi.URLParam(r, "id")
	e, err := s.content.UpsertExperience(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "experience.update", UserID: &ac.User.ID, Target: e.ID})
	httpx.WriteJSON(w, http.StatusOK, e)
}

func (s *Server) handleAdminDeleteExperience(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	id := chi.URLParam(r, "id")
	if err := s.content.DeleteExperience(r.Context(), id); err != nil {
		writeContentErr(w, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "experience.delete", UserID: &ac.User.ID, Target: id})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminListHonors(w http.ResponseWriter, r *http.Request) {
	items, err := s.content.Honors(r.Context(), true)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (s *Server) handleAdminGetHonor(w http.ResponseWriter, r *http.Request) {
	h, err := s.content.HonorByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeContentErr(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, h)
}

func (s *Server) handleAdminCreateHonor(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.Honor
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	h, err := s.content.UpsertHonor(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "honor.create", UserID: &ac.User.ID, Target: h.ID})
	httpx.WriteJSON(w, http.StatusOK, h)
}

func (s *Server) handleAdminUpdateHonor(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.Honor
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	body.ID = chi.URLParam(r, "id")
	h, err := s.content.UpsertHonor(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "honor.update", UserID: &ac.User.ID, Target: h.ID})
	httpx.WriteJSON(w, http.StatusOK, h)
}

func (s *Server) handleAdminDeleteHonor(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	id := chi.URLParam(r, "id")
	if err := s.content.DeleteHonor(r.Context(), id); err != nil {
		writeContentErr(w, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "honor.delete", UserID: &ac.User.ID, Target: id})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminListEducation(w http.ResponseWriter, r *http.Request) {
	items, err := s.content.Education(r.Context())
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (s *Server) handleAdminGetEducation(w http.ResponseWriter, r *http.Request) {
	e, err := s.content.EducationByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeContentErr(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, e)
}

func (s *Server) handleAdminCreateEducation(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.Education
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	e, err := s.content.UpsertEducation(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "education.create", UserID: &ac.User.ID, Target: e.ID})
	httpx.WriteJSON(w, http.StatusOK, e)
}

func (s *Server) handleAdminUpdateEducation(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.Education
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	body.ID = chi.URLParam(r, "id")
	e, err := s.content.UpsertEducation(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "education.update", UserID: &ac.User.ID, Target: e.ID})
	httpx.WriteJSON(w, http.StatusOK, e)
}

func (s *Server) handleAdminDeleteEducation(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	id := chi.URLParam(r, "id")
	if err := s.content.DeleteEducation(r.Context(), id); err != nil {
		writeContentErr(w, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "education.delete", UserID: &ac.User.ID, Target: id})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminListTimeline(w http.ResponseWriter, r *http.Request) {
	items, err := s.content.Timeline(r.Context())
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (s *Server) handleAdminGetTimeline(w http.ResponseWriter, r *http.Request) {
	item, err := s.content.TimelineByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeContentErr(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminCreateTimeline(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.TimelineEvent
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := s.content.UpsertTimeline(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "timeline.create", UserID: &ac.User.ID, Target: item.ID})
	httpx.WriteJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminUpdateTimeline(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body model.TimelineEvent
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	body.ID = chi.URLParam(r, "id")
	item, err := s.content.UpsertTimeline(r.Context(), body)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "timeline.update", UserID: &ac.User.ID, Target: item.ID})
	httpx.WriteJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminDeleteTimeline(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	id := chi.URLParam(r, "id")
	if err := s.content.DeleteTimeline(r.Context(), id); err != nil {
		writeContentErr(w, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "timeline.delete", UserID: &ac.User.ID, Target: id})
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminGetResume(w http.ResponseWriter, r *http.Request) {
	resume, err := s.content.Resume(r.Context())
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resume)
}

func (s *Server) handleAdminPutResume(w http.ResponseWriter, r *http.Request) {
	ac := adminFrom(r.Context())
	var body struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	resume, err := s.content.SetResumeURL(r.Context(), body.URL)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.audit.Record(r.Context(), audit.Entry{Action: "resume.update", UserID: &ac.User.ID, Target: body.URL})
	httpx.WriteJSON(w, http.StatusOK, resume)
}

func writeContentErr(w http.ResponseWriter, err error) {
	if errors.Is(err, content.ErrNotFound) {
		httpx.WriteClientError(w, http.StatusNotFound, "not found")
		return
	}
	httpx.WriteClientError(w, http.StatusInternalServerError, "internal server error")
}
