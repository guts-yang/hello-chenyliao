package server_test

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/guts-yang/hello-gutsyang/server/internal/config"
	"github.com/guts-yang/hello-gutsyang/server/internal/media"
	"github.com/guts-yang/hello-gutsyang/server/internal/server"
)

func testServer(t *testing.T) *server.Server {
	t.Helper()
	cfg := config.Config{
		Addr:                ":0",
		PublicBaseURL:       "http://localhost:8080",
		AppOrigin:           "http://localhost:5173",
		AllowedOrigins:      []string{"http://localhost:5173"},
		SessionCookie:       "hello_gutsyang_admin_session",
		ChatOwnerCookie:     "hello_gutsyang_chat_owner",
		MediaProvider:       "local",
		MediaLocalDir:       t.TempDir(),
		MediaMaxUploadBytes: 10 * 1024 * 1024,
		DeepSeekBaseURL:     "https://api.deepseek.com",
		DeepSeekModel:       "deepseek-v4-flash",
		AdminEmail:          "admin@example.com",
		AdminPassword:       "password123",
		RateLimitLogin:      config.RateLimitConfig{Burst: 100, Window: time.Minute},
		RateLimitChat:       config.RateLimitConfig{Burst: 100, Window: time.Minute},
		RateLimitAIList:     config.RateLimitConfig{Burst: 100, Window: time.Minute},
		RateLimitAdminAI:    config.RateLimitConfig{Burst: 100, Window: time.Minute},
		LoginLockout:        config.LockoutConfig{Threshold: 5, Window: 15 * time.Minute, BlockFor: 15 * time.Minute},
	}
	s, err := server.New(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	return s
}

func TestHealthAndPublicHome(t *testing.T) {
	s := testServer(t)
	ts := httptest.NewServer(s.Handler())
	t.Cleanup(ts.Close)

	res, err := http.Get(ts.URL + "/api/health")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("status=%d", res.StatusCode)
	}
	var health map[string]any
	_ = json.NewDecoder(res.Body).Decode(&health)
	if health["ok"] != true {
		t.Fatalf("health=%v", health)
	}
	if health["demoMode"] != true {
		t.Fatalf("expected demoMode")
	}

	res2, err := http.Get(ts.URL + "/api/public/home")
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	if res2.StatusCode != 200 {
		t.Fatalf("home status=%d", res2.StatusCode)
	}
	var home map[string]any
	_ = json.NewDecoder(res2.Body).Decode(&home)
	if home["profile"] == nil {
		t.Fatal("missing profile")
	}
}

func TestChatNDJSONDemo(t *testing.T) {
	s := testServer(t)
	ts := httptest.NewServer(s.Handler())
	t.Cleanup(ts.Close)

	body := `{"locale":"zh","messages":[{"role":"user","content":"你好"}]}`
	res, err := http.Post(ts.URL+"/api/chat", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("status=%d body=%s", res.StatusCode, b)
	}
	if !strings.Contains(res.Header.Get("Content-Type"), "ndjson") {
		t.Fatalf("ct=%s", res.Header.Get("Content-Type"))
	}
	if res.Header.Get("X-Chat-Session-Id") == "" {
		t.Fatal("missing session id")
	}
	sc := bufio.NewScanner(res.Body)
	gotDelta := false
	for sc.Scan() {
		var ev map[string]any
		if err := json.Unmarshal(sc.Bytes(), &ev); err != nil {
			t.Fatal(err)
		}
		if ev["t"] == "d" {
			gotDelta = true
		}
	}
	if !gotDelta {
		t.Fatal("expected delta events")
	}
}

func TestAdminLoginCSRFAndProfile(t *testing.T) {
	s := testServer(t)
	ts := httptest.NewServer(s.Handler())
	t.Cleanup(ts.Close)
	client := ts.Client()

	loginBody := bytes.NewBufferString(`{"email":"admin@example.com","password":"password123"}`)
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/admin/login", loginBody)
	req.Header.Set("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("login=%d %s", res.StatusCode, b)
	}
	cookies := res.Cookies()
	var session, csrf string
	for _, c := range cookies {
		if c.Name == "hello_gutsyang_admin_session" {
			session = c.Value
		}
		if c.Name == "hello_gutsyang_admin_session_csrf" {
			csrf = c.Value
		}
	}
	if session == "" || csrf == "" {
		t.Fatalf("cookies=%v", cookies)
	}

	req2, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/admin/session", nil)
	req2.AddCookie(&http.Cookie{Name: "hello_gutsyang_admin_session", Value: session})
	res2, err := client.Do(req2)
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	var sess map[string]any
	_ = json.NewDecoder(res2.Body).Decode(&sess)
	if sess["authenticated"] != true {
		t.Fatalf("session=%v", sess)
	}

	req3, _ := http.NewRequest(http.MethodPut, ts.URL+"/api/admin/profile", strings.NewReader(`{"nameZh":"测试","nameEn":"Test","handle":"gutsyang","role":{"zh":"r","en":"r"},"slogan":{"zh":"s","en":"s"},"bio":{"zh":"b","en":"b"},"socials":[]}`))
	req3.Header.Set("Content-Type", "application/json")
	req3.Header.Set("X-CSRF-Token", csrf)
	req3.AddCookie(&http.Cookie{Name: "hello_gutsyang_admin_session", Value: session})
	req3.AddCookie(&http.Cookie{Name: "hello_gutsyang_admin_session_csrf", Value: csrf})
	res3, err := client.Do(req3)
	if err != nil {
		t.Fatal(err)
	}
	defer res3.Body.Close()
	if res3.StatusCode != 200 {
		b, _ := io.ReadAll(res3.Body)
		t.Fatalf("profile put=%d %s", res3.StatusCode, b)
	}
}

func TestResume404(t *testing.T) {
	s := testServer(t)
	ts := httptest.NewServer(s.Handler())
	t.Cleanup(ts.Close)
	res, err := http.Get(ts.URL + "/api/resume.pdf")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 404 {
		t.Fatalf("status=%d", res.StatusCode)
	}
}

func TestMediaMimeAllowlist(t *testing.T) {
	if !media.IsAllowedMimeType("image/png") {
		t.Fatal("png should be allowed")
	}
	if media.IsAllowedMimeType("application/exe") {
		t.Fatal("exe should be rejected")
	}
}

func TestChatSessionsMemory(t *testing.T) {
	s := testServer(t)
	ts := httptest.NewServer(s.Handler())
	t.Cleanup(ts.Close)

	body := `{"locale":"en","messages":[{"role":"user","content":"hello world from test"}]}`
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/chat", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	sid := res.Header.Get("X-Chat-Session-Id")
	if sid == "" {
		t.Fatal("missing session")
	}
	owner := ""
	for _, c := range res.Cookies() {
		if c.Name == "hello_gutsyang_chat_owner" {
			owner = c.Value
		}
	}
	if owner == "" {
		t.Fatal("missing owner cookie")
	}
	io.Copy(io.Discard, res.Body)

	req2, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/ai/sessions", nil)
	req2.AddCookie(&http.Cookie{Name: "hello_gutsyang_chat_owner", Value: owner})
	res2, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	var sessions []map[string]any
	_ = json.NewDecoder(res2.Body).Decode(&sessions)
	if len(sessions) == 0 {
		t.Fatal("expected session list")
	}
}
