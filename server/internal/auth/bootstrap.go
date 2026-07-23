package auth

import (
	"context"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// BootstrapInput captures the env-driven credentials we may seed the admin
// user from on first boot.
type BootstrapInput struct {
	Email         string
	PasswordHash  string
	PasswordPlain string
}

// BootstrapResult tells the caller what happened so it can log meaningfully.
type BootstrapResult struct {
	// Mode is the resolved mode the Service should report from now on.
	Mode Mode
	// Created is true when this call inserted a fresh admin row.
	Created bool
	// AlreadyHadAdmin is true when an admin already existed in the repo and
	// the env input was ignored. Useful so ops can know to remove the env
	// once persistence has taken over.
	AlreadyHadAdmin bool
	// Email is the email of the bootstrapped or pre-existing admin, lowercased.
	Email string
}

// Bootstrap ensures there is an admin user in the given repo. The behavior is:
//
//  1. If the repo already has at least one admin, nothing is inserted.
//  2. Otherwise, if BootstrapInput has both Email and a hash/plain, an admin
//     is created. Plaintext is bcrypted in this function; it never reaches
//     the repo or the database.
//  3. Otherwise, the result is ModeDisabled and the caller is expected to log
//     a "no admin configured" warning.
//
// modeOnSuccess is the Mode to report when an admin exists (either created or
// already present). Pass ModeMySQL or ModeMemory depending on which repo
// was wired.
func Bootstrap(ctx context.Context, repo UserRepo, in BootstrapInput, modeOnSuccess Mode) (BootstrapResult, error) {
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))

	existing, err := repo.Count(ctx)
	if err != nil {
		return BootstrapResult{}, fmt.Errorf("auth: bootstrap count: %w", err)
	}
	if existing > 0 {
		return BootstrapResult{
			Mode:            modeOnSuccess,
			AlreadyHadAdmin: true,
		}, nil
	}

	if in.Email == "" {
		return BootstrapResult{Mode: ModeDisabled}, nil
	}

	hash := strings.TrimSpace(in.PasswordHash)
	if hash == "" {
		if in.PasswordPlain == "" {
			return BootstrapResult{Mode: ModeDisabled}, nil
		}
		raw, err := bcrypt.GenerateFromPassword([]byte(in.PasswordPlain), bcrypt.DefaultCost)
		if err != nil {
			return BootstrapResult{}, fmt.Errorf("auth: bootstrap hash plain: %w", err)
		}
		hash = string(raw)
	}

	user, created, err := repo.Bootstrap(ctx, in.Email, hash)
	if err != nil {
		return BootstrapResult{}, err
	}
	return BootstrapResult{
		Mode:            modeOnSuccess,
		Created:         created,
		AlreadyHadAdmin: !created,
		Email:           user.Email,
	}, nil
}
