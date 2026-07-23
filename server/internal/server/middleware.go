package server

import (
	"log"
	"net/http"
	"strings"
	"time"
)

func (s *Server) withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rw.status, time.Since(start).Truncate(time.Millisecond))
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (s *Server) withCORS(next http.Handler) http.Handler {
	allowed := map[string]struct{}{}
	for _, o := range s.cfg.AllowedOrigins {
		allowed[o] = struct{}{}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if _, ok := allowed[strings.TrimRight(origin, "/")]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token, X-Requested-With")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Expose-Headers", "X-Chat-Session-Id, Retry-After")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) withCSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			next.ServeHTTP(w, r)
			return
		}
		// login is exempt; CSRF enforced inside requireAdmin(true) for admin mutations
		next.ServeHTTP(w, r)
	})
}

func (s *Server) csrfCookieName() string {
	return s.cfg.SessionCookie + "_csrf"
}

func (s *Server) buildSessionCookie(token string, expires time.Time) *http.Cookie {
	maxAge := int(time.Until(expires).Seconds())
	if maxAge < 0 {
		maxAge = 0
	}
	return &http.Cookie{
		Name:     s.cfg.SessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Secure:   s.cfg.CookieSecure.Resolve(s.cfg.AppOrigin),
		MaxAge:   maxAge,
		Expires:  expires,
	}
}

func (s *Server) buildCSRFCookie(token string, expires time.Time) *http.Cookie {
	maxAge := int(time.Until(expires).Seconds())
	if maxAge < 0 {
		maxAge = 0
	}
	return &http.Cookie{
		Name:     s.csrfCookieName(),
		Value:    token,
		Path:     "/",
		HttpOnly: false,
		SameSite: http.SameSiteStrictMode,
		Secure:   s.cfg.CookieSecure.Resolve(s.cfg.AppOrigin),
		MaxAge:   maxAge,
		Expires:  expires,
	}
}

func (s *Server) clearAuthCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: s.cfg.SessionCookie, Value: "", Path: "/", MaxAge: -1})
	http.SetCookie(w, &http.Cookie{Name: s.csrfCookieName(), Value: "", Path: "/", MaxAge: -1})
}
