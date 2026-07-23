package content_test

import (
	"context"
	"testing"

	"github.com/guts-yang/hello-gutsyang/server/internal/content"
)

func TestSeedAndHome(t *testing.T) {
	svc, err := content.NewMemoryService()
	if err != nil {
		t.Fatal(err)
	}
	home, err := svc.Home(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if home.Profile.Handle != "gutsyang" {
		t.Fatalf("handle=%q", home.Profile.Handle)
	}
	if len(home.Projects) == 0 {
		t.Fatal("expected seeded projects")
	}
	p, err := svc.ProjectBySlug(context.Background(), "llm-hessian-unlearning")
	if err != nil {
		t.Fatal(err)
	}
	if p.Kind != "academic" {
		t.Fatalf("kind=%q", p.Kind)
	}
}

func TestSearchProjects(t *testing.T) {
	svc, err := content.NewMemoryService()
	if err != nil {
		t.Fatal(err)
	}
	hits, err := svc.SearchProjects(context.Background(), "langgraph", 4)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) == 0 {
		t.Fatal("expected search hits")
	}
}
