package media

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/guts-yang/hello-gutsyang/server/internal/model"
)

// AllowedMimeTypes lists the Content-Type values accepted on the upload PUT.
// Kept as a package-level var so tests / callers can override if they want a
// stricter or looser policy without changing the service contract.
var AllowedMimeTypes = map[string]struct{}{
	"image/png":       {},
	"image/jpeg":      {},
	"image/webp":      {},
	"image/gif":       {},
	"image/svg+xml":   {},
	"video/mp4":       {},
	"video/webm":      {},
	"application/pdf": {},
}

// IsAllowedMimeType reports whether the provided Content-Type (which may include
// charset suffixes such as ";charset=utf-8") is part of the allow list.
func IsAllowedMimeType(contentType string) bool {
	if contentType == "" {
		return false
	}
	primary := strings.ToLower(strings.TrimSpace(strings.SplitN(contentType, ";", 2)[0]))
	_, ok := AllowedMimeTypes[primary]
	return ok
}

type UploadTicket struct {
	Path      string
	ExpiresAt time.Time
}

type Service struct {
	mu        sync.RWMutex
	dataDir   string
	publicURL string
	tickets   map[string]UploadTicket
	stopOnce  sync.Once
	stop      chan struct{}
}

// NewService creates a media service rooted at dataDir/uploads. A janitor
// goroutine is spawned to evict expired upload tickets so long-running
// processes do not leak memory through never-claimed tickets.
func NewService(ctx context.Context, dataDir, publicURL string) (*Service, error) {
	mediaDir := filepath.Join(dataDir, "uploads")
	if err := os.MkdirAll(mediaDir, 0o755); err != nil {
		return nil, err
	}
	svc := &Service{
		dataDir:   mediaDir,
		publicURL: strings.TrimRight(publicURL, "/"),
		tickets:   map[string]UploadTicket{},
		stop:      make(chan struct{}),
	}

	go svc.runJanitor(ctx, time.Minute)

	return svc, nil
}

// Stop releases the janitor goroutine. Idempotent.
func (s *Service) Stop() {
	s.stopOnce.Do(func() { close(s.stop) })
}

func (s *Service) runJanitor(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stop:
			return
		case <-ticker.C:
			s.evictExpired()
		}
	}
}

func (s *Service) evictExpired() {
	now := time.Now().UTC()
	s.mu.Lock()
	defer s.mu.Unlock()
	for token, ticket := range s.tickets {
		if ticket.ExpiresAt.Before(now) {
			delete(s.tickets, token)
		}
	}
}

func (s *Service) CreateUpload(ctx context.Context, req model.MediaUploadRequest) (string, model.MediaUploadResponse, error) {
	select {
	case <-ctx.Done():
		return "", model.MediaUploadResponse{}, ctx.Err()
	default:
	}

	folder, err := sanitizeFolder(req.Folder)
	if err != nil {
		return "", model.MediaUploadResponse{}, err
	}
	name := sanitizeFileName(req.FileName)
	if name == "" {
		return "", model.MediaUploadResponse{}, errors.New("invalid file name")
	}

	suffix, err := randomToken(4)
	if err != nil {
		return "", model.MediaUploadResponse{}, err
	}
	key := filepath.ToSlash(filepath.Join(folder, fmt.Sprintf("%d-%s-%s", time.Now().Unix(), suffix, name)))

	if err := s.assertWithinDataDir(key); err != nil {
		return "", model.MediaUploadResponse{}, err
	}

	token, err := randomToken(16)
	if err != nil {
		return "", model.MediaUploadResponse{}, err
	}
	expiresAt := time.Now().UTC().Add(15 * time.Minute)

	s.mu.Lock()
	s.tickets[token] = UploadTicket{Path: key, ExpiresAt: expiresAt}
	s.mu.Unlock()

	response := model.MediaUploadResponse{
		UploadURL: fmt.Sprintf("%s/v1/admin/media/upload/%s", s.publicURL, token),
		PublicURL: fmt.Sprintf("%s/uploads/%s", s.publicURL, key),
	}
	return token, response, nil
}

func (s *Service) StoreUpload(ctx context.Context, token string, body io.Reader) (string, error) {
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	default:
	}

	s.mu.Lock()
	ticket, ok := s.tickets[token]
	if ok {
		delete(s.tickets, token)
	}
	s.mu.Unlock()

	if !ok || ticket.ExpiresAt.Before(time.Now().UTC()) {
		return "", errors.New("upload ticket expired")
	}

	if err := s.assertWithinDataDir(ticket.Path); err != nil {
		return "", err
	}

	fullPath := filepath.Join(s.dataDir, filepath.FromSlash(ticket.Path))
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		return "", err
	}

	file, err := os.Create(fullPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	if _, err := io.Copy(file, body); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s/uploads/%s", s.publicURL, ticket.Path), nil
}

func (s *Service) FileSystemPath(rel string) string {
	return filepath.Join(s.dataDir, filepath.FromSlash(rel))
}

// assertWithinDataDir guarantees the resolved upload path stays under the
// configured uploads directory. This is the second line of defense against a
// malicious or buggy client that smuggles "../" segments past sanitizeFolder.
func (s *Service) assertWithinDataDir(rel string) error {
	root, err := filepath.Abs(s.dataDir)
	if err != nil {
		return err
	}
	target, err := filepath.Abs(filepath.Join(s.dataDir, filepath.FromSlash(rel)))
	if err != nil {
		return err
	}
	rootWithSep := root + string(os.PathSeparator)
	if target == root || strings.HasPrefix(target, rootWithSep) {
		return nil
	}
	return errors.New("invalid upload path")
}

// sanitizeFolder normalizes the folder portion of an upload key, rejecting any
// attempt to traverse outside the uploads directory ("..", absolute paths, or
// drive letters on Windows). We intentionally avoid filepath.Clean on the
// input 鈥?it would silently consume ".." segments and let traversal slip
// through. Instead we reject the request as soon as any forbidden segment is
// observed.
func sanitizeFolder(raw string) (string, error) {
	folder := strings.TrimSpace(raw)
	folder = strings.ReplaceAll(folder, "\\", "/")
	if strings.HasPrefix(folder, "/") {
		return "", errors.New("invalid upload folder")
	}
	if strings.Contains(folder, ":") {
		// Reject Windows-style drive letters such as "C:".
		return "", errors.New("invalid upload folder")
	}
	folder = strings.Trim(folder, "/")
	if folder == "" {
		return "projects", nil
	}
	segments := strings.Split(folder, "/")
	cleaned := make([]string, 0, len(segments))
	for _, segment := range segments {
		switch segment {
		case "", ".", "..":
			return "", errors.New("invalid upload folder")
		}
		cleaned = append(cleaned, segment)
	}
	return strings.Join(cleaned, "/"), nil
}

func sanitizeFileName(name string) string {
	name = strings.TrimSpace(name)
	name = strings.ReplaceAll(name, "\\", "/")
	name = filepath.Base(name)
	if name == "." || name == ".." || name == "/" {
		return ""
	}
	name = strings.ReplaceAll(name, " ", "-")
	return name
}

func randomToken(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate random token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}
