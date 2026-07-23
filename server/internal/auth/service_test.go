package auth

import (
	"context"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// newTestService wires the in-memory repos and pre-seeds an admin row, which
// is what every test below wants. Returns the service plus the seeded user
// for tests that need its UUID.
func newTestService(t *testing.T, email, password string) (*Service, *UserRecord) {
	t.Helper()
	users := NewMemoryUserRepo()
	sessions := NewMemorySessionRepo()
	if email != "" && password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
		if err != nil {
			t.Fatalf("hash seed password: %v", err)
		}
		_, _, err = users.Bootstrap(context.Background(), email, string(hash))
		if err != nil {
			t.Fatalf("bootstrap admin: %v", err)
		}
	}
	mode := ModeMemory
	if email == "" {
		mode = ModeDisabled
	}
	svc := New(users, sessions, mode, Options{})
	if email == "" {
		return svc, nil
	}
	u, err := users.ByEmail(context.Background(), email)
	if err != nil {
		t.Fatalf("seed lookup: %v", err)
	}
	return svc, u
}

func TestServiceDisabledWithoutAdmin(t *testing.T) {
	t.Parallel()
	svc, _ := newTestService(t, "", "")
	if svc.Enabled() {
		t.Fatalf("expected disabled when no admin seeded")
	}
	if _, err := svc.Login(context.Background(), "a@b.c", "anything", "", ""); err == nil {
		t.Fatalf("login on disabled service should fail")
	}
}

func TestBootstrapWithHashEnablesService(t *testing.T) {
	t.Parallel()
	users := NewMemoryUserRepo()
	hash, err := bcrypt.GenerateFromPassword([]byte("hunter22"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	res, err := Bootstrap(context.Background(), users, BootstrapInput{
		Email:        "tony@example.com",
		PasswordHash: string(hash),
	}, ModeMemory)
	if err != nil {
		t.Fatalf("bootstrap: %v", err)
	}
	if !res.Created {
		t.Fatalf("expected Created=true on fresh repo")
	}
	if res.Mode != ModeMemory {
		t.Fatalf("expected ModeMemory, got %s", res.Mode)
	}
}

func TestBootstrapPlainPasswordIsHashedBeforeStorage(t *testing.T) {
	t.Parallel()
	users := NewMemoryUserRepo()
	_, err := Bootstrap(context.Background(), users, BootstrapInput{
		Email:         "tony@example.com",
		PasswordPlain: "plain-secret",
	}, ModeMemory)
	if err != nil {
		t.Fatalf("bootstrap: %v", err)
	}
	u, err := users.ByEmail(context.Background(), "tony@example.com")
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if u.PasswordHash == "plain-secret" {
		t.Fatalf("password hash should not be the plaintext")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte("plain-secret")); err != nil {
		t.Fatalf("stored bcrypt should verify against the original plaintext: %v", err)
	}
}

func TestBootstrapSkipsWhenAdminExists(t *testing.T) {
	t.Parallel()
	users := NewMemoryUserRepo()
	if _, _, err := users.Bootstrap(context.Background(), "first@example.com", "$2a$04$abcdefghijklmnopqrstuv"); err != nil {
		t.Fatalf("seed: %v", err)
	}
	res, err := Bootstrap(context.Background(), users, BootstrapInput{
		Email:         "second@example.com",
		PasswordPlain: "ignored-secret",
	}, ModeMemory)
	if err != nil {
		t.Fatalf("bootstrap: %v", err)
	}
	if res.Created {
		t.Fatalf("expected Created=false when admin already present")
	}
	if !res.AlreadyHadAdmin {
		t.Fatalf("expected AlreadyHadAdmin=true")
	}
}

func TestLoginRejectsBadCredentialsWithoutPanic(t *testing.T) {
	t.Parallel()
	svc, _ := newTestService(t, "a@b.c", "right-pass")

	cases := []struct {
		name     string
		email    string
		password string
	}{
		// Different lengths and missing fields used to crash an earlier
		// ConstantTimeCompare-based impl; the regression should stay covered.
		{"empty inputs", "", ""},
		{"short email", "x", ""},
		{"long email", strings.Repeat("z", 200), strings.Repeat("p", 100)},
		{"correct email, wrong password", "a@b.c", "wrong"},
		{"wrong email, correct password", "another@b.c", "right-pass"},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("panic on %q: %v", tc.name, r)
				}
			}()
			session, err := svc.Login(context.Background(), tc.email, tc.password, "", "")
			if err == nil {
				t.Fatalf("want auth error, got session=%+v", session)
			}
			if !IsInvalidCredentials(err) {
				t.Fatalf("want IsInvalidCredentials, got %v", err)
			}
			if session != nil {
				t.Fatalf("want nil session on failure, got %+v", session)
			}
		})
	}
}

func TestLoginAcceptsCorrectCredentialsAndRoundtripsSession(t *testing.T) {
	t.Parallel()
	svc, _ := newTestService(t, "a@b.c", "right-pass")

	session, err := svc.Login(context.Background(), "a@b.c", "right-pass", "127.0.0.1", "go-test/1.0")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	if session == nil || session.Token == "" {
		t.Fatalf("want non-empty token")
	}

	got, err := svc.Session(context.Background(), session.Token)
	if err != nil {
		t.Fatalf("session lookup failed: %v", err)
	}
	if got == nil || got.User.Email != "a@b.c" {
		t.Fatalf("want session for a@b.c, got %+v", got)
	}

	if err := svc.Logout(context.Background(), session.Token); err != nil {
		t.Fatalf("logout failed: %v", err)
	}
	if got, _ := svc.Session(context.Background(), session.Token); got != nil {
		t.Fatalf("want session removed after logout, got %+v", got)
	}
}

func TestChangePasswordRevokesOtherSessions(t *testing.T) {
	t.Parallel()
	svc, user := newTestService(t, "a@b.c", "right-pass")

	first, err := svc.Login(context.Background(), "a@b.c", "right-pass", "", "")
	if err != nil {
		t.Fatalf("first login: %v", err)
	}
	second, err := svc.Login(context.Background(), "a@b.c", "right-pass", "", "")
	if err != nil {
		t.Fatalf("second login: %v", err)
	}

	if err := svc.ChangePassword(context.Background(), user.ID, "right-pass", "new-pass-123", second.Token); err != nil {
		t.Fatalf("change password: %v", err)
	}

	if got, _ := svc.Session(context.Background(), first.Token); got != nil {
		t.Fatalf("first session should be revoked after password change")
	}
	if got, _ := svc.Session(context.Background(), second.Token); got == nil {
		t.Fatalf("current session (except token) should survive password change")
	}
	if _, err := svc.Login(context.Background(), "a@b.c", "right-pass", "", ""); err == nil {
		t.Fatalf("old password should no longer work")
	}
	if _, err := svc.Login(context.Background(), "a@b.c", "new-pass-123", "", ""); err != nil {
		t.Fatalf("new password should work: %v", err)
	}
}

func TestChangeEmailRequiresCurrentPassword(t *testing.T) {
	t.Parallel()
	svc, user := newTestService(t, "a@b.c", "right-pass")

	if err := svc.ChangeEmail(context.Background(), user.ID, "wrong-pass", "x@y.z"); !IsInvalidCredentials(err) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
	if err := svc.ChangeEmail(context.Background(), user.ID, "right-pass", "not-an-email"); !IsInvalidEmail(err) {
		t.Fatalf("expected invalid email, got %v", err)
	}
	if err := svc.ChangeEmail(context.Background(), user.ID, "right-pass", "x@y.z"); err != nil {
		t.Fatalf("change email: %v", err)
	}
	if _, err := svc.Login(context.Background(), "a@b.c", "right-pass", "", ""); err == nil {
		t.Fatalf("old email should no longer log in")
	}
	if _, err := svc.Login(context.Background(), "x@y.z", "right-pass", "", ""); err != nil {
		t.Fatalf("new email should log in: %v", err)
	}
}

func TestSessionSlidingRenewal(t *testing.T) {
	t.Parallel()
	svc, _ := newTestService(t, "a@b.c", "right-pass")

	session, err := svc.Login(context.Background(), "a@b.c", "right-pass", "", "")
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	// Two consecutive lookups should both succeed and yield the same or later
	// ExpiresAt (sliding renewal never goes backwards).
	first, err := svc.Session(context.Background(), session.Token)
	if err != nil || first == nil {
		t.Fatalf("first lookup: %v", err)
	}
	second, err := svc.Session(context.Background(), session.Token)
	if err != nil || second == nil {
		t.Fatalf("second lookup: %v", err)
	}
	if second.ExpiresAt.Before(first.ExpiresAt) {
		t.Fatalf("sliding renewal must not move ExpiresAt backwards")
	}
}

func TestPurgeExpiredRemovesStaleRowsOnly(t *testing.T) {
	t.Parallel()
	users := NewMemoryUserRepo()
	sessions := NewMemorySessionRepo()
	hash, _ := bcrypt.GenerateFromPassword([]byte("right-pass"), bcrypt.MinCost)
	_, _, _ = users.Bootstrap(context.Background(), "a@b.c", string(hash))
	svc := New(users, sessions, ModeMemory, Options{})

	live, err := svc.Login(context.Background(), "a@b.c", "right-pass", "", "")
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	// Hand-inject an already-expired session into the repo so we can be sure
	// PurgeExpired picks it up without sleeping.
	_ = sessions.Create(context.Background(), SessionRecord{
		Token:     "stale",
		ExpiresAt: time.Now().UTC().Add(-time.Hour),
	})

	n, err := svc.PurgeExpired(context.Background())
	if err != nil {
		t.Fatalf("purge: %v", err)
	}
	if n != 1 {
		t.Fatalf("want 1 purged, got %d", n)
	}
	if got, _ := svc.Session(context.Background(), live.Token); got == nil {
		t.Fatalf("live session must survive PurgeExpired")
	}
}
