package ai

import (
	"context"
	"fmt"

	"github.com/guts-yang/hello-gutsyang/server/internal/content"
	"github.com/guts-yang/hello-gutsyang/server/internal/model"
)

type ToolPayload map[string]any

func ToolDefs() []map[string]any {
	return []map[string]any{
		{
			"type": "function",
			"function": map[string]any{
				"name":        "search_projects",
				"description": "Look up the most relevant projects by a free-text query.",
				"parameters": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"query": map[string]any{"type": "string"},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			"type": "function",
			"function": map[string]any{
				"name":        "show_project",
				"description": "Surface a specific project by slug.",
				"parameters": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"slug": map[string]any{"type": "string"},
					},
					"required": []string{"slug"},
				},
			},
		},
		{
			"type": "function",
			"function": map[string]any{
				"name":        "show_experience",
				"description": "Surface a specific experience by slug.",
				"parameters": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"slug": map[string]any{"type": "string"},
					},
					"required": []string{"slug"},
				},
			},
		},
		{
			"type": "function",
			"function": map[string]any{
				"name":        "show_resume",
				"description": "Offer a PDF resume download link.",
				"parameters": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"lang": map[string]any{"type": "string", "enum": []string{"zh", "en"}},
					},
				},
			},
		},
	}
}

func ExecuteTool(ctx context.Context, cms *content.Service, name string, args map[string]any, locale model.Locale) ToolPayload {
	pick := func(ls model.LocalizedString) string {
		if locale == model.LocaleEN {
			return ls.EN
		}
		return ls.ZH
	}
	switch name {
	case "search_projects":
		q, _ := args["query"].(string)
		hits, err := cms.SearchProjects(ctx, q, 4)
		if err != nil {
			return ToolPayload{"kind": "error", "message": err.Error()}
		}
		items := make([]map[string]string, 0, len(hits))
		for _, p := range hits {
			items = append(items, map[string]string{
				"slug":    p.Slug,
				"title":   pick(p.Title),
				"tagline": pick(p.Tagline),
				"href":    fmt.Sprintf("/%s/projects/%s", locale, p.Slug),
			})
		}
		return ToolPayload{"kind": "projects", "items": items}
	case "show_project":
		slug, _ := args["slug"].(string)
		p, err := cms.ProjectBySlug(ctx, slug)
		if err != nil {
			return ToolPayload{"kind": "error", "message": "project not found: " + slug}
		}
		return ToolPayload{
			"kind": "project", "slug": p.Slug,
			"title": pick(p.Title), "tagline": pick(p.Tagline), "summary": pick(p.Summary),
			"href": fmt.Sprintf("/%s/projects/%s", locale, p.Slug),
		}
	case "show_experience":
		slug, _ := args["slug"].(string)
		e, err := cms.ExperienceBySlug(ctx, slug)
		if err != nil {
			return ToolPayload{"kind": "error", "message": "experience not found: " + slug}
		}
		return ToolPayload{
			"kind": "experience", "slug": e.Slug,
			"org": pick(e.Org), "role": pick(e.Role), "summary": pick(e.Summary),
			"href": fmt.Sprintf("/%s/experience/%s", locale, e.Slug),
		}
	case "show_resume":
		lang := string(locale)
		if v, ok := args["lang"].(string); ok && (v == "zh" || v == "en") {
			lang = v
		}
		label := "Download resume PDF"
		if lang == "zh" {
			label = "下载简历 PDF"
		}
		return ToolPayload{
			"kind": "resume", "href": "/api/resume.pdf?lang=" + lang, "label": label,
		}
	default:
		return ToolPayload{"kind": "error", "message": "unknown tool: " + name}
	}
}

func SummarizeToolResult(payload ToolPayload) string {
	kind, _ := payload["kind"].(string)
	switch kind {
	case "projects":
		items, _ := payload["items"].([]map[string]string)
		if len(items) == 0 {
			// json unmarshaled as []any when from map
			if raw, ok := payload["items"].([]any); ok {
				if len(raw) == 0 {
					return "No matching projects."
				}
				lines := make([]string, 0, len(raw))
				for i, it := range raw {
					m, _ := it.(map[string]any)
					lines = append(lines, fmt.Sprintf("%d. %v — %v (%v)", i+1, m["title"], m["tagline"], m["href"]))
				}
				return joinLines(lines)
			}
			return "No matching projects."
		}
		lines := make([]string, 0, len(items))
		for i, p := range items {
			lines = append(lines, fmt.Sprintf("%d. %s — %s (%s)", i+1, p["title"], p["tagline"], p["href"]))
		}
		return joinLines(lines)
	case "project":
		return fmt.Sprintf("Project %v: %v. Summary: %v. URL: %v",
			payload["title"], payload["tagline"], payload["summary"], payload["href"])
	case "experience":
		return fmt.Sprintf("Experience %v (%v): %v. URL: %v",
			payload["org"], payload["role"], payload["summary"], payload["href"])
	case "resume":
		return fmt.Sprintf("Resume PDF available at %v", payload["href"])
	case "error":
		return fmt.Sprintf("(tool error) %v", payload["message"])
	default:
		return fmt.Sprintf("%v", payload)
	}
}

func joinLines(lines []string) string {
	out := ""
	for i, l := range lines {
		if i > 0 {
			out += "\n"
		}
		out += l
	}
	return out
}
