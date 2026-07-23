package content_test

import (
	"context"
	"testing"

	"github.com/guts-yang/hello-gutsyang/server/internal/content"
	"github.com/guts-yang/hello-gutsyang/server/internal/model"
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
	if home.Profile.NameEN != "Tony Liao" {
		t.Fatalf("nameEn=%q", home.Profile.NameEN)
	}
	if len(home.Projects) == 0 {
		t.Fatal("expected seeded projects")
	}
	if len(home.Experiences) < 4 {
		t.Fatalf("expected enriched experiences, got %d", len(home.Experiences))
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

func TestEducationTimelineResumeCRUD(t *testing.T) {
	svc, err := content.NewMemoryService()
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	edu, err := svc.UpsertEducation(ctx, model.Education{
		School:       model.LocalizedString{ZH: "测试大学", EN: "Test University"},
		Degree:       model.LocalizedString{ZH: "本科", EN: "Bachelor"},
		StartedAt:    "2020-09",
		DisplayOrder: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	got, err := svc.EducationByID(ctx, edu.ID)
	if err != nil || got.School.EN != "Test University" {
		t.Fatalf("education get: %v %+v", err, got)
	}
	if err := svc.DeleteEducation(ctx, edu.ID); err != nil {
		t.Fatal(err)
	}

	item, err := svc.UpsertTimeline(ctx, model.TimelineEvent{
		Date:  "2026-01",
		Kind:  "work",
		Title: model.LocalizedString{ZH: "事件", EN: "Event"},
		Body:  model.LocalizedString{ZH: "说明", EN: "Body"},
	})
	if err != nil {
		t.Fatal(err)
	}
	tl, err := svc.TimelineByID(ctx, item.ID)
	if err != nil || tl.Kind != "work" {
		t.Fatalf("timeline get: %v %+v", err, tl)
	}
	if err := svc.DeleteTimeline(ctx, item.ID); err != nil {
		t.Fatal(err)
	}

	resume, err := svc.SetResumeURL(ctx, "/uploads/resume/tony.pdf")
	if err != nil || !resume.Available {
		t.Fatalf("resume set: %v %+v", err, resume)
	}
	resume, err = svc.Resume(ctx)
	if err != nil || resume.URL != "/uploads/resume/tony.pdf" {
		t.Fatalf("resume get: %v %+v", err, resume)
	}
	stats, err := svc.Stats(ctx)
	if err != nil || stats["resume"] != 1 {
		t.Fatalf("stats=%v err=%v", stats, err)
	}
}
