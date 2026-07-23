import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, apiUrl } from '@/lib/api';
import type { ChatMessage, ChatSession } from '@/types';

type StreamEvent =
  | { t: 'd'; v: string }
  | { t: 'tool'; name: string; data: unknown }
  | { t: 'err'; message: string };

interface ChatContextValue {
  open: boolean;
  busy: boolean;
  error: string;
  sessionId?: string;
  sessions: ChatSession[];
  messages: ChatMessage[];
  setOpen: (open: boolean) => void;
  listSessions: () => Promise<void>;
  openSession: (id: string) => Promise<void>;
  newSession: () => void;
  removeSession: (id: string) => Promise<void>;
  send: (content: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const listSessions = useCallback(async () => {
    try {
      setSessions(await apiFetch<ChatSession[]>('/api/ai/sessions'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const openSession = useCallback(async (id: string) => {
    setSessionId(id);
    setMessages(await apiFetch<ChatMessage[]>(`/api/ai/sessions/${encodeURIComponent(id)}`));
  }, []);

  const newSession = useCallback(() => {
    setSessionId(undefined);
    setMessages([]);
    setError('');
  }, []);

  const removeSession = useCallback(
    async (id: string) => {
      await apiFetch(`/api/ai/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (sessionId === id) newSession();
      await listSessions();
    },
    [sessionId, newSession, listSessions],
  );

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || busy) return;
      setError('');
      const userMessage: ChatMessage = { role: 'user', content: text };
      const answer: ChatMessage = { role: 'assistant', content: '', tools: [] };
      setMessages((prev) => [...prev, userMessage, answer]);
      setBusy(true);
      try {
        const response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            locale: 'zh',
            sessionId,
            messages: [...messages, userMessage].map(({ role, content: value }) => ({
              role,
              content: value,
            })),
          }),
        });
        if (!response.ok || !response.body) {
          throw new Error((await response.text()) || `Request failed (${response.status})`);
        }
        setSessionId(response.headers.get('x-chat-session-id') || sessionId);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';
        const tools: Array<{ name: string; data: unknown }> = [];
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as StreamEvent;
            if (event.t === 'd') {
              assistantContent += event.v;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') {
                  next[next.length - 1] = { ...last, content: assistantContent, tools: [...tools] };
                }
                return next;
              });
            }
            if (event.t === 'tool') {
              tools.push({ name: event.name, data: event.data });
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') {
                  next[next.length - 1] = { ...last, tools: [...tools] };
                }
                return next;
              });
            }
            if (event.t === 'err') throw new Error(event.message);
          }
          if (done) break;
        }
        await listSessions();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant' && !last.content) {
            next[next.length - 1] = {
              ...last,
              content: '暂时无法连接 AI 服务。',
            };
          }
          return next;
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, sessionId, messages, listSessions],
  );

  const value = useMemo(
    () => ({
      open,
      busy,
      error,
      sessionId,
      sessions,
      messages,
      setOpen,
      listSessions,
      openSession,
      newSession,
      removeSession,
      send,
    }),
    [
      open,
      busy,
      error,
      sessionId,
      sessions,
      messages,
      listSessions,
      openSession,
      newSession,
      removeSession,
      send,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
