package httpx

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

type errorBody struct {
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func WriteClientError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, errorBody{OK: false, Message: message})
}

func WriteServerError(w http.ResponseWriter, r *http.Request, err error) {
	log.Printf("[err] %s %s: %v", r.Method, r.URL.Path, err)
	WriteClientError(w, http.StatusInternalServerError, "internal server error")
}

func WriteRateLimited(w http.ResponseWriter, retryAfter time.Duration) {
	sec := int(retryAfter.Seconds())
	if sec < 1 {
		sec = 1
	}
	w.Header().Set("Retry-After", itoa(sec))
	WriteClientError(w, http.StatusTooManyRequests, "rate limit exceeded")
}

func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}
	if xr := strings.TrimSpace(r.Header.Get("X-Real-Ip")); xr != "" {
		return xr
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [16]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
