package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Addr              string
	PublicBaseURL     string
	AppOrigin         string
	AllowedOrigins    []string
	DatabaseDSN       string
	RedisAddr         string
	RedisPassword     string
	RedisDB           int
	AdminEmail        string
	AdminPassword     string
	AdminPasswordHash string
	DeepSeekAPIKey    string
	DeepSeekBaseURL   string
	DeepSeekModel     string
	SessionCookie     string
	ChatOwnerCookie   string
	CookieSecure      CookieSecureMode

	MediaProvider       string
	MediaLocalDir       string
	MediaMaxUploadBytes int64

	RateLimitLogin   RateLimitConfig
	RateLimitChat    RateLimitConfig
	RateLimitAIList  RateLimitConfig
	RateLimitAdminAI RateLimitConfig

	LoginLockout LockoutConfig
}

type LockoutConfig struct {
	Threshold int
	Window    time.Duration
	BlockFor  time.Duration
}

type CookieSecureMode string

const (
	CookieSecureAuto CookieSecureMode = "auto"
	CookieSecureOn   CookieSecureMode = "on"
	CookieSecureOff  CookieSecureMode = "off"
)

func (m CookieSecureMode) Resolve(appOrigin string) bool {
	switch m {
	case CookieSecureOn:
		return true
	case CookieSecureOff:
		return false
	default:
		return strings.HasPrefix(strings.ToLower(appOrigin), "https://")
	}
}

type RateLimitConfig struct {
	Burst  int
	Window time.Duration
}

type fileConfig struct {
	Server struct {
		Addr           string   `yaml:"addr"`
		PublicBaseURL  string   `yaml:"public_base_url"`
		AppOrigin      string   `yaml:"app_origin"`
		AllowedOrigins []string `yaml:"allowed_origins"`
	} `yaml:"server"`
	Database struct {
		DSN string `yaml:"dsn"`
	} `yaml:"database"`
	Redis struct {
		Addr     string `yaml:"addr"`
		Password string `yaml:"password"`
		DB       int    `yaml:"db"`
	} `yaml:"redis"`
	Media struct {
		Provider       string `yaml:"provider"`
		LocalDir       string `yaml:"local_dir"`
		MaxUploadBytes int64  `yaml:"max_upload_bytes"`
	} `yaml:"media"`
	AI struct {
		BaseURL string `yaml:"base_url"`
		Model   string `yaml:"model"`
	} `yaml:"ai"`
	RateLimit struct {
		Login   rateYAML `yaml:"login"`
		Chat    rateYAML `yaml:"chat"`
		AIList  rateYAML `yaml:"ai_list"`
		AdminAI rateYAML `yaml:"admin_ai"`
	} `yaml:"rate_limit"`
	LoginLockout struct {
		Threshold int    `yaml:"threshold"`
		Window    string `yaml:"window"`
		BlockFor  string `yaml:"block_for"`
	} `yaml:"login_lockout"`
	Cookies struct {
		Session   string `yaml:"session"`
		ChatOwner string `yaml:"chat_owner"`
		Secure    string `yaml:"secure"`
	} `yaml:"cookies"`
}

type rateYAML struct {
	Burst  int    `yaml:"burst"`
	Window string `yaml:"window"`
}

// Load reads optional yaml then applies env overrides (env wins).
func Load() (Config, error) {
	loadDotEnv()
	fc := fileConfig{}
	if path := resolveConfigPath(); path != "" {
		raw, err := os.ReadFile(path)
		if err != nil {
			return Config{}, fmt.Errorf("config: read %s: %w", path, err)
		}
		if err := yaml.Unmarshal(raw, &fc); err != nil {
			return Config{}, fmt.Errorf("config: parse %s: %w", path, err)
		}
	}

	appOrigin := firstNonEmpty(os.Getenv("APP_ORIGIN"), fc.Server.AppOrigin, "http://localhost:5173")
	cfg := Config{
		Addr:              firstNonEmpty(os.Getenv("SERVER_ADDR"), fc.Server.Addr, ":8080"),
		PublicBaseURL:     firstNonEmpty(os.Getenv("PUBLIC_BASE_URL"), os.Getenv("GO_API_URL"), fc.Server.PublicBaseURL, "http://localhost:8080"),
		AppOrigin:         appOrigin,
		AllowedOrigins:    parseAllowedOrigins(appOrigin, firstNonEmpty(os.Getenv("ALLOWED_ORIGINS"), strings.Join(fc.Server.AllowedOrigins, ",")), fc.Server.AllowedOrigins),
		DatabaseDSN:       firstNonEmpty(os.Getenv("DATABASE_URL"), os.Getenv("DATABASE_DSN"), fc.Database.DSN),
		RedisAddr:         firstNonEmpty(os.Getenv("REDIS_ADDR"), redisAddrFromURL(os.Getenv("REDIS_URL")), fc.Redis.Addr),
		RedisPassword:     firstNonEmpty(os.Getenv("REDIS_PASSWORD"), fc.Redis.Password),
		RedisDB:           getEnvInt("REDIS_DB", fc.Redis.DB),
		AdminEmail:        os.Getenv("ADMIN_BOOTSTRAP_EMAIL"),
		AdminPassword:     os.Getenv("ADMIN_BOOTSTRAP_PASSWORD"),
		AdminPasswordHash: os.Getenv("ADMIN_BOOTSTRAP_PASSWORD_HASH"),
		DeepSeekAPIKey:    os.Getenv("DEEPSEEK_API_KEY"),
		DeepSeekBaseURL:   firstNonEmpty(os.Getenv("DEEPSEEK_BASE_URL"), fc.AI.BaseURL, "https://api.deepseek.com"),
		DeepSeekModel:     firstNonEmpty(os.Getenv("DEEPSEEK_MODEL"), fc.AI.Model, "deepseek-v4-flash"),
		SessionCookie:     firstNonEmpty(os.Getenv("ADMIN_SESSION_COOKIE"), fc.Cookies.Session, "hello_gutsyang_admin_session"),
		ChatOwnerCookie:   firstNonEmpty(os.Getenv("CHAT_OWNER_COOKIE"), fc.Cookies.ChatOwner, "hello_gutsyang_chat_owner"),
		CookieSecure:      parseCookieSecure(firstNonEmpty(os.Getenv("COOKIE_SECURE"), fc.Cookies.Secure)),

		MediaProvider:       firstNonEmpty(os.Getenv("MEDIA_PROVIDER"), fc.Media.Provider, "local"),
		MediaLocalDir:       firstNonEmpty(os.Getenv("MEDIA_LOCAL_DIR"), fc.Media.LocalDir, "./uploads"),
		MediaMaxUploadBytes: getEnvInt64("MEDIA_MAX_UPLOAD_BYTES", pickInt64(fc.Media.MaxUploadBytes, 10*1024*1024)),

		RateLimitLogin:   rateFrom(fc.RateLimit.Login, 10, 5*time.Minute, "RATE_LIMIT_LOGIN_BURST", "RATE_LIMIT_LOGIN_WINDOW"),
		RateLimitChat:    rateFrom(fc.RateLimit.Chat, 5, 30*time.Second, "RATE_LIMIT_CHAT_BURST", "RATE_LIMIT_CHAT_WINDOW"),
		RateLimitAIList:  rateFrom(fc.RateLimit.AIList, 60, time.Minute, "RATE_LIMIT_AI_LIST_BURST", "RATE_LIMIT_AI_LIST_WINDOW"),
		RateLimitAdminAI: rateFrom(fc.RateLimit.AdminAI, 30, time.Minute, "RATE_LIMIT_ADMIN_AI_BURST", "RATE_LIMIT_ADMIN_AI_WINDOW"),

		LoginLockout: LockoutConfig{
			Threshold: getEnvInt("LOGIN_LOCKOUT_THRESHOLD", pickInt(fc.LoginLockout.Threshold, 5)),
			Window:    getEnvDuration("LOGIN_LOCKOUT_WINDOW", parseDurationOr(fc.LoginLockout.Window, 15*time.Minute)),
			BlockFor:  getEnvDuration("LOGIN_LOCKOUT_BLOCK_FOR", parseDurationOr(fc.LoginLockout.BlockFor, 15*time.Minute)),
		},
	}
	return cfg, nil
}

func rateFrom(y rateYAML, burst int, window time.Duration, burstEnv, windowEnv string) RateLimitConfig {
	b := burst
	if y.Burst > 0 {
		b = y.Burst
	}
	w := window
	if d := parseDurationOr(y.Window, 0); d > 0 {
		w = d
	}
	return RateLimitConfig{
		Burst:  getEnvInt(burstEnv, b),
		Window: getEnvDuration(windowEnv, w),
	}
}

func resolveConfigPath() string {
	if p := os.Getenv("APP_CONFIG"); p != "" {
		return p
	}
	candidates := []string{
		"../config/app.yaml",
		"../../config/app.yaml",
		"config/app.yaml",
		filepath.Join("..", "config", "app.yaml"),
	}
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	return ""
}

func loadDotEnv() {
	for _, candidate := range []string{".env.local", ".env", "../.env.local", "../.env", "../../.env.local", "../../.env"} {
		_ = loadEnvFile(candidate)
	}
}

func loadEnvFile(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		val = strings.Trim(val, `"'`)
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, val)
		}
	}
	return nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func redisAddrFromURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	raw = strings.TrimPrefix(raw, "redis://")
	if i := strings.Index(raw, "/"); i >= 0 {
		raw = raw[:i]
	}
	if at := strings.LastIndex(raw, "@"); at >= 0 {
		raw = raw[at+1:]
	}
	return raw
}

func parseAllowedOrigins(appOrigin, extra string, fromYAML []string) []string {
	seen := map[string]struct{}{}
	out := []string{}
	add := func(value string) {
		v := strings.TrimRight(strings.TrimSpace(value), "/")
		if v == "" {
			return
		}
		if _, ok := seen[v]; ok {
			return
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	add(appOrigin)
	for _, c := range fromYAML {
		add(c)
	}
	for _, c := range strings.Split(extra, ",") {
		add(c)
	}
	for _, c := range []string{
		"http://localhost:5173",
		"http://localhost:3000",
		"http://127.0.0.1:5173",
		"http://127.0.0.1:3000",
	} {
		add(c)
	}
	return out
}

func parseCookieSecure(raw string) CookieSecureMode {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "true", "1", "on", "yes":
		return CookieSecureOn
	case "false", "0", "off", "no":
		return CookieSecureOff
	default:
		return CookieSecureAuto
	}
}

func getEnvInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 0 {
		return fallback
	}
	return v
}

func getEnvInt64(key string, fallback int64) int64 {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}

func parseDurationOr(raw string, fallback time.Duration) time.Duration {
	if raw == "" {
		return fallback
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}

func pickInt(v, fallback int) int {
	if v > 0 {
		return v
	}
	return fallback
}

func pickInt64(v, fallback int64) int64 {
	if v > 0 {
		return v
	}
	return fallback
}
