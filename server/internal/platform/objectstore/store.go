package objectstore

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Store is a replaceable object storage interface.
type Store interface {
	Put(ctx context.Context, key string, r io.Reader, contentType string) (publicURL string, err error)
	PublicURL(key string) string
	LocalRoot() string
}

// Local writes files under root and serves them via publicBaseURL/uploads/...
type Local struct {
	Root          string
	PublicBaseURL string
}

func NewLocal(root, publicBaseURL string) (*Local, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}
	return &Local{
		Root:          root,
		PublicBaseURL: strings.TrimRight(publicBaseURL, "/"),
	}, nil
}

func (l *Local) Put(_ context.Context, key string, r io.Reader, _ string) (string, error) {
	key = strings.TrimPrefix(filepath.ToSlash(key), "/")
	if key == "" || strings.Contains(key, "..") {
		return "", fmt.Errorf("objectstore: invalid key")
	}
	dst := filepath.Join(l.Root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return "", err
	}
	f, err := os.Create(dst)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, r); err != nil {
		return "", err
	}
	return l.PublicURL(key), nil
}

func (l *Local) PublicURL(key string) string {
	key = strings.TrimPrefix(filepath.ToSlash(key), "/")
	return l.PublicBaseURL + "/uploads/" + key
}

func (l *Local) LocalRoot() string { return l.Root }

// S3 is a reserved stub so callers can switch MEDIA_PROVIDER=s3 later.
type S3 struct {
	Bucket   string
	Region   string
	Endpoint string
}

func NewS3(bucket, region, endpoint string) (*S3, error) {
	if bucket == "" {
		return nil, fmt.Errorf("objectstore: s3 bucket required")
	}
	return &S3{Bucket: bucket, Region: region, Endpoint: endpoint}, nil
}

func (s *S3) Put(context.Context, string, io.Reader, string) (string, error) {
	return "", fmt.Errorf("objectstore: s3 provider is reserved but not implemented yet")
}

func (s *S3) PublicURL(key string) string {
	return fmt.Sprintf("s3://%s/%s", s.Bucket, strings.TrimPrefix(key, "/"))
}

func (s *S3) LocalRoot() string { return "" }
