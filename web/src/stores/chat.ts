import { defineStore } from 'pinia';
import { apiFetch, apiUrl } from '@/lib/api';
import type { ChatMessage, ChatSession, Locale } from '@/types';

type StreamEvent =
  | { t: 'd'; v: string }
  | { t: 'tool'; name: string; data: unknown }
  | { t: 'err'; message: string };

export const useChatStore = defineStore('chat', {
  state: () => ({
    open: false,
    busy: false,
    error: '',
    sessionId: undefined as string | undefined,
    sessions: [] as ChatSession[],
    messages: [] as ChatMessage[],
  }),
  actions: {
    async listSessions() {
      try { this.sessions = await apiFetch<ChatSession[]>('/api/ai/sessions'); }
      catch (error) { this.error = error instanceof Error ? error.message : String(error); }
    },
    async openSession(id: string) {
      this.sessionId = id;
      this.messages = await apiFetch<ChatMessage[]>(`/api/ai/sessions/${encodeURIComponent(id)}`);
    },
    newSession() {
      this.sessionId = undefined;
      this.messages = [];
      this.error = '';
    },
    async removeSession(id: string) {
      await apiFetch(`/api/ai/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (this.sessionId === id) this.newSession();
      await this.listSessions();
    },
    async send(content: string, locale: Locale) {
      const text = content.trim();
      if (!text || this.busy) return;
      this.error = '';
      this.messages.push({ role: 'user', content: text });
      const answer: ChatMessage = { role: 'assistant', content: '', tools: [] };
      this.messages.push(answer);
      this.busy = true;
      try {
        const response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            locale,
            sessionId: this.sessionId,
            messages: this.messages.slice(0, -1).map(({ role, content: value }) => ({ role, content: value })),
          }),
        });
        if (!response.ok || !response.body) throw new Error(await response.text() || `Request failed (${response.status})`);
        this.sessionId = response.headers.get('x-chat-session-id') || this.sessionId;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as StreamEvent;
            if (event.t === 'd') answer.content += event.v;
            if (event.t === 'tool') answer.tools?.push({ name: event.name, data: event.data });
            if (event.t === 'err') throw new Error(event.message);
          }
          if (done) break;
        }
        await this.listSessions();
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        if (!answer.content) answer.content = locale === 'zh' ? '暂时无法连接 AI 服务。' : 'The AI service is currently unavailable.';
      } finally {
        this.busy = false;
      }
    },
  },
});
