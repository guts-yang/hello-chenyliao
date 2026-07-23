package server

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/guts-yang/hello-gutsyang/server/internal/media"
	"github.com/guts-yang/hello-gutsyang/server/internal/model"
	"github.com/guts-yang/hello-gutsyang/server/internal/platform/httpx"
)

func (s *Server) handleUploadURL(w http.ResponseWriter, r *http.Request) {
	var body model.MediaUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	_, resp, err := s.media.CreateUpload(r.Context(), body)
	if err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	resp.UploadURL = strings.Replace(resp.UploadURL, "/v1/admin/media/upload/", "/api/admin/media/upload/", 1)
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (s *Server) handleUploadOptions(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleUploadByToken(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	ct := r.Header.Get("Content-Type")
	if !media.IsAllowedMimeType(ct) {
		httpx.WriteClientError(w, http.StatusUnsupportedMediaType, "unsupported media type")
		return
	}
	limited := http.MaxBytesReader(w, r.Body, s.cfg.MediaMaxUploadBytes)
	publicURL, err := s.media.StoreUpload(r.Context(), token, limited)
	if err != nil {
		httpx.WriteClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "publicUrl": publicURL})
}

func (s *Server) handleUploadPost(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleUploadPut(w http.ResponseWriter, r *http.Request) {
	pathname := r.URL.Query().Get("pathname")
	pathname = strings.TrimPrefix(pathname, "/")
	if pathname == "" || strings.Contains(pathname, "..") {
		httpx.WriteClientError(w, http.StatusBadRequest, "invalid pathname")
		return
	}
	ct := r.Header.Get("Content-Type")
	if !media.IsAllowedMimeType(ct) {
		httpx.WriteClientError(w, http.StatusUnsupportedMediaType, "unsupported media type")
		return
	}
	limited := http.MaxBytesReader(w, r.Body, s.cfg.MediaMaxUploadBytes)
	root := s.cfg.MediaLocalDir
	if s.store != nil && s.store.LocalRoot() != "" {
		root = s.store.LocalRoot()
	}
	dst := filepath.Join(root, filepath.FromSlash(pathname))
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	f, err := os.Create(dst)
	if err != nil {
		httpx.WriteServerError(w, r, err)
		return
	}
	defer f.Close()
	if _, err := io.Copy(f, limited); err != nil {
		httpx.WriteClientError(w, http.StatusRequestEntityTooLarge, "file too large")
		return
	}
	publicURL := strings.TrimRight(s.cfg.PublicBaseURL, "/") + "/uploads/" + pathname
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "publicUrl": publicURL})
}
