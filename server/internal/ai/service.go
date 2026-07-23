package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/guts-yang/hello-gutsyang/server/internal/content"
	"github.com/guts-yang/hello-gutsyang/server/internal/model"
)

const MaxToolRounds = 3

type Service struct {
	content *content.Service
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
}

type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	Name       string     `json:"name,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
}

type ToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type Event struct {
	T       string `json:"t"`
	V       string `json:"v,omitempty"`
	Name    string `json:"name,omitempty"`
	Data    any    `json:"data,omitempty"`
	Message string `json:"message,omitempty"`
}

func NewService(contentSvc *content.Service, apiKey, baseURL, modelName string) *Service {
	return &Service{
		content: contentSvc,
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		model:   modelName,
		client:  &http.Client{Timeout: 90 * time.Second},
	}
}

func (s *Service) DemoMode() bool { return strings.TrimSpace(s.apiKey) == "" }

func (s *Service) BuildSystemPrompt(ctx context.Context, locale model.Locale) (string, error) {
	profile, err := s.content.Profile(ctx)
	if err != nil {
		return "", err
	}
	projects, err := s.content.Projects(ctx, false)
	if err != nil {
		return "", err
	}
	experiences, err := s.content.Experiences(ctx, false)
	if err != nil {
		return "", err
	}
	pick := func(ls model.LocalizedString) string {
		if locale == model.LocaleEN {
			return ls.EN
		}
		return ls.ZH
	}
	name := profile.NameZH
	if locale == model.LocaleEN {
		name = profile.NameEN
	}
	lines := []string{}
	if locale == model.LocaleEN {
		lines = append(lines,
			fmt.Sprintf("You are the AI assistant on %s's personal website.", profile.NameEN),
			"Answer from the site content. Be concise, factual, and do not invent experience.",
		)
	} else {
		lines = append(lines,
			fmt.Sprintf("你是 %s（%s）个人网站上的 AI 助手。", profile.NameZH, profile.NameEN),
			"请基于站点内容回答，保持简洁、真实，不要编造经历。",
		)
	}
	_ = name
	projTitles := make([]string, 0, len(projects))
	for _, p := range projects {
		projTitles = append(projTitles, pick(p.Title))
	}
	expOrgs := make([]string, 0, len(experiences))
	for _, e := range experiences {
		expOrgs = append(expOrgs, pick(e.Org))
	}
	lines = append(lines,
		"Role: "+pick(profile.Role),
		"Slogan: "+pick(profile.Slogan),
		"Bio: "+pick(profile.Bio),
		"Projects: "+strings.Join(projTitles, ", "),
		"Experiences: "+strings.Join(expOrgs, ", "),
	)
	return strings.Join(lines, "\n"), nil
}

func (s *Service) DemoText(locale model.Locale) string {
	if locale == model.LocaleEN {
		return "(Demo mode) Set DEEPSEEK_API_KEY to enable live answers.\n\nExample: His focus is LLM machine unlearning and multi-agent orchestration."
	}
	return "（演示模式）请配置 DEEPSEEK_API_KEY 后再试。\n\n示例回答：他的核心方向是大模型机器遗忘学习与多智能体架构。"
}

// StreamChat yields NDJSON events: d / tool / err.
func (s *Service) StreamChat(ctx context.Context, locale model.Locale, messages []Message) (<-chan Event, error) {
	out := make(chan Event, 16)
	go func() {
		defer close(out)
		if s.DemoMode() {
			text := s.DemoText(locale)
			for _, chunk := range chunkText(text, 8) {
				select {
				case <-ctx.Done():
					return
				case out <- Event{T: "d", V: chunk}:
				}
			}
			return
		}
		system, err := s.BuildSystemPrompt(ctx, locale)
		if err != nil {
			out <- Event{T: "err", Message: err.Error()}
			return
		}
		history := make([]Message, 0, len(messages)+1)
		history = append(history, Message{Role: "system", Content: system})
		for _, m := range messages {
			if m.Role == "system" {
				continue
			}
			history = append(history, m)
		}
		for round := 0; round <= MaxToolRounds; round++ {
			enableTools := round < MaxToolRounds
			content, toolCalls, err := s.streamOnce(ctx, history, enableTools, out)
			if err != nil {
				out <- Event{T: "err", Message: err.Error()}
				return
			}
			if len(toolCalls) == 0 {
				return
			}
			assistant := Message{Role: "assistant", Content: content, ToolCalls: toolCalls}
			history = append(history, assistant)
			for _, tc := range toolCalls {
				var args map[string]any
				_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
				if args == nil {
					args = map[string]any{}
				}
				payload := ExecuteTool(ctx, s.content, tc.Function.Name, args, locale)
				out <- Event{T: "tool", Name: tc.Function.Name, Data: payload}
				history = append(history, Message{
					Role:       "tool",
					ToolCallID: tc.ID,
					Content:    SummarizeToolResult(payload),
				})
			}
		}
	}()
	return out, nil
}

func (s *Service) streamOnce(ctx context.Context, messages []Message, enableTools bool, out chan<- Event) (string, []ToolCall, error) {
	body := map[string]any{
		"model":       s.model,
		"stream":      true,
		"temperature": 0.6,
		"messages":    messages,
	}
	if enableTools {
		body["tools"] = ToolDefs()
	} else {
		body["tool_choice"] = "none"
	}
	raw, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/chat/completions", bytes.NewReader(raw))
	if err != nil {
		return "", nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", nil, fmt.Errorf("upstream %d: %s", resp.StatusCode, string(b))
	}

	type delta struct {
		Content   string `json:"content"`
		ToolCalls []struct {
			Index    int    `json:"index"`
			ID       string `json:"id"`
			Function struct {
				Name      string `json:"name"`
				Arguments string `json:"arguments"`
			} `json:"function"`
		} `json:"tool_calls"`
	}
	type chunk struct {
		Choices []struct {
			Delta delta `json:"delta"`
		} `json:"choices"`
	}

	collected := ""
	toolMap := map[int]*ToolCall{}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "[DONE]" {
			break
		}
		var ch chunk
		if err := json.Unmarshal([]byte(payload), &ch); err != nil || len(ch.Choices) == 0 {
			continue
		}
		d := ch.Choices[0].Delta
		if d.Content != "" {
			collected += d.Content
			out <- Event{T: "d", V: d.Content}
		}
		for _, tc := range d.ToolCalls {
			cur, ok := toolMap[tc.Index]
			if !ok {
				cur = &ToolCall{ID: tc.ID, Type: "function"}
				toolMap[tc.Index] = cur
			}
			if tc.ID != "" {
				cur.ID = tc.ID
			}
			if tc.Function.Name != "" {
				cur.Function.Name = tc.Function.Name
			}
			cur.Function.Arguments += tc.Function.Arguments
		}
	}
	if err := scanner.Err(); err != nil {
		return collected, nil, err
	}
	calls := make([]ToolCall, 0, len(toolMap))
	for i := 0; i < len(toolMap); i++ {
		if tc, ok := toolMap[i]; ok {
			calls = append(calls, *tc)
		}
	}
	return collected, calls, nil
}

func (s *Service) Translate(ctx context.Context, items map[string]string) (map[string]string, error) {
	keys := make([]string, 0, len(items))
	for k := range items {
		keys = append(keys, k)
	}
	if len(keys) == 0 {
		return map[string]string{}, nil
	}
	if s.DemoMode() {
		out := map[string]string{}
		for k, v := range items {
			if v == "" {
				out[k] = v
			} else {
				out[k] = "[EN] " + v
			}
		}
		return out, nil
	}
	system := `You are a bilingual CV editor. Translate Chinese values to concise professional English.
Keep acronyms, pinyin names, URLs and dates unchanged. Reply with a JSON object whose keys match the input keys exactly.`
	body := map[string]any{
		"model":           s.model,
		"stream":          false,
		"temperature":     0.2,
		"response_format": map[string]string{"type": "json_object"},
		"messages": []Message{
			{Role: "system", Content: system},
			{Role: "user", Content: mustJSON(items)},
		},
	}
	raw, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/chat/completions", bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("upstream translate failed: %d", resp.StatusCode)
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	content := "{}"
	if len(parsed.Choices) > 0 {
		content = parsed.Choices[0].Message.Content
	}
	content = strings.TrimSpace(content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)
	var result map[string]string
	_ = json.Unmarshal([]byte(content), &result)
	out := map[string]string{}
	for _, k := range keys {
		if v, ok := result[k]; ok && v != "" {
			out[k] = v
		} else {
			out[k] = items[k]
		}
	}
	return out, nil
}

func chunkText(text string, size int) []string {
	r := []rune(text)
	var out []string
	for len(r) > 0 {
		n := size
		if n > len(r) {
			n = len(r)
		}
		out = append(out, string(r[:n]))
		r = r[n:]
	}
	return out
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
