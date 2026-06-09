'use client';

import * as React from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n';
import { ToolCard, type ToolPayload } from './tool-cards';

type ChatPart =
  | { kind: 'text'; value: string }
  | { kind: 'tool'; payload: ToolPayload };

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  parts?: ChatPart[];
};

type ServerEvent =
  | { t: 'd'; v: string }
  | { t: 'tool'; name: string; data: ToolPayload }
  | { t: 'err'; message: string };

/**
 * Pure chat surface. Speaks the NDJSON protocol exposed by /api/chat:
 *   - {"t":"d","v":"..."}   accumulated into the assistant message text
 *   - {"t":"tool", ...}     rendered as a rich card inline
 *   - {"t":"err", ...}      replaces the draft with a friendly error
 *
 * Set `defaultPrompt` to pre-fill the input (e.g. when the command palette
 * forwards a query into the chat).
 */
export function ChatRoom({
  locale,
  className,
  variant = 'card',
  defaultPrompt = '',
}: {
  locale: Locale;
  className?: string;
  variant?: 'card' | 'bare';
  defaultPrompt?: string;
}) {
  const t = useTranslations('sections.ai');
  const [input, setInput] = React.useState(defaultPrompt);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draftText, setDraftText] = React.useState('');
  const [draftParts, setDraftParts] = React.useState<ChatPart[]>([]);
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const flushTimerRef = React.useRef<number | null>(null);
  const draftTextRef = React.useRef('');
  const draftPartsRef = React.useRef<ChatPart[]>([]);
  const nextMessagesRef = React.useRef<ChatMessage[]>([]);

  React.useEffect(() => {
    if (defaultPrompt) {
      setInput(defaultPrompt);
      inputRef.current?.focus();
    }
  }, [defaultPrompt]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: pending ? 'auto' : 'smooth',
    });
  }, [messages.length, draftText, draftParts.length, pending]);

  React.useEffect(() => {
    return () => {
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
    };
  }, []);

  function scheduleFlush() {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      setDraftText(draftTextRef.current);
      setDraftParts([...draftPartsRef.current]);
    }, 60);
  }

  async function send(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    const text = (override ?? input).trim();
    if (!text || pending) return;

    const next: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text },
    ];
    setMessages(next);
    nextMessagesRef.current = next;
    setInput('');
    draftTextRef.current = '';
    draftPartsRef.current = [];
    setDraftText('');
    setDraftParts([]);
    setPending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          locale,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffered.indexOf('\n')) >= 0) {
          const line = buffered.slice(0, nl).trim();
          buffered = buffered.slice(nl + 1);
          if (!line) continue;
          let event: ServerEvent;
          try {
            event = JSON.parse(line) as ServerEvent;
          } catch {
            continue;
          }
          if (event.t === 'd') {
            draftTextRef.current += event.v;
            scheduleFlush();
          } else if (event.t === 'tool') {
            draftPartsRef.current = [
              ...draftPartsRef.current,
              { kind: 'tool', payload: event.data },
            ];
            scheduleFlush();
          } else if (event.t === 'err') {
            throw new Error(event.message);
          }
        }
      }

      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const finalText = draftTextRef.current;
      const finalParts: ChatPart[] = [];
      if (finalText) finalParts.push({ kind: 'text', value: finalText });
      finalParts.push(...draftPartsRef.current);

      setDraftText('');
      setDraftParts([]);
      setMessages([
        ...nextMessagesRef.current,
        { role: 'assistant', content: finalText, parts: finalParts },
      ]);
    } catch (err) {
      console.warn('[chat]', err);
      setMessages([
        ...next,
        {
          role: 'assistant',
          content:
            locale === 'zh'
              ? '抱歉，AI 助手暂时不可用，请稍后再试。'
              : 'Sorry, the AI assistant is temporarily unavailable. Please try again later.',
        },
      ]);
    } finally {
      draftTextRef.current = '';
      draftPartsRef.current = [];
      setPending(false);
    }
  }

  const wrapperClass =
    variant === 'card'
      ? cn('glass relative flex flex-col rounded-3xl p-6 sm:p-7', className)
      : cn('flex h-full w-full flex-col', className);

  const liveParts: ChatPart[] = React.useMemo(() => {
    const out: ChatPart[] = [];
    if (draftText) out.push({ kind: 'text', value: draftText });
    out.push(...draftParts);
    return out;
  }, [draftText, draftParts]);

  return (
    <div className={wrapperClass}>
      {variant === 'card' && (
        <div className="flex items-center gap-2 border-b border-white/30 dark:border-white/10 pb-4">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{t('title')}</h2>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="scrollbar-none flex-1 space-y-3 overflow-y-auto px-1 py-3">
        {messages.length === 0 && !pending && (
          <Suggestions
            locale={locale}
            onPick={(q) => {
              setInput(q);
              void send(undefined, q);
            }}
          />
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} parts={m.parts ?? [{ kind: 'text', value: m.content }]} />
        ))}
        {pending && (
          <Bubble
            role="assistant"
            parts={liveParts.length > 0 ? liveParts : [{ kind: 'text', value: t('thinking') }]}
            pending
          />
        )}
      </div>

      <form
        onSubmit={(e) => send(e)}
        className="flex items-center gap-2 border-t border-white/30 dark:border-white/10 pt-3"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder')}
          className="h-11 flex-1 rounded-full border border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/5 px-4 text-sm outline-none ring-0 transition-colors focus:border-[hsl(var(--primary)/0.5)]"
        />
        <Button type="submit" disabled={pending || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
          <span className="sr-only">{t('send')}</span>
        </Button>
      </form>
    </div>
  );
}

function Bubble({
  role,
  parts,
  pending,
}: {
  role: 'user' | 'assistant';
  parts: ChatPart[];
  pending?: boolean;
}) {
  return (
    <div className={cn('flex', role === 'user' ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[92%] space-y-1.5 rounded-2xl px-4 py-2 text-sm leading-relaxed',
          role === 'user'
            ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
            : 'border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/5',
          pending && 'opacity-90',
        )}
      >
        {parts.map((part, i) =>
          part.kind === 'text' ? (
            <p key={i} className="whitespace-pre-wrap break-words">
              {part.value}
            </p>
          ) : (
            <ToolCard key={i} payload={part.payload} />
          ),
        )}
      </div>
    </div>
  );
}

const ZH_SUGGESTIONS = [
  '介绍一下你最硬核的项目',
  '你的研究方向是什么？',
  '能发我一份简历吗？',
];
const EN_SUGGESTIONS = [
  'Walk me through your most hardcore project',
  'What is your research direction?',
  'Send me your resume',
];

function Suggestions({
  locale,
  onPick,
}: {
  locale: Locale;
  onPick: (q: string) => void;
}) {
  const items = locale === 'zh' ? ZH_SUGGESTIONS : EN_SUGGESTIONS;
  return (
    <div className="grid h-full place-items-center px-4 text-center">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {locale === 'zh' ? '试试这些问题：' : 'Try one of these:'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {items.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className="rounded-full border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-[hsl(var(--primary)/0.4)] hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
