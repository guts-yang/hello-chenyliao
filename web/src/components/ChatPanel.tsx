import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Send, X } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { t } from '@/i18n';
import type { Locale } from '@/types';
import { cn } from '@/lib/utils';

export function ChatPanel({ locale }: { locale: Locale }) {
  const chat = useChat();
  const copy = t(locale);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const { open, listSessions } = chat;
  useEffect(() => {
    if (open) void listSessions();
  }, [open, listSessions]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages, chat.busy]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = input;
    setInput('');
    await chat.send(value, locale);
  }

  return (
    <AnimatePresence>
      {chat.open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close chat overlay"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => chat.setOpen(false)}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[720px] flex-col border-l border-primary/10 bg-[#101010]"
          >
            <header className="flex items-center justify-between border-b border-primary/10 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[#E1E0CC]">{copy.chat.title}</h2>
                <p className="text-xs text-gray-500">{copy.chat.subtitle}</p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/15 text-primary hover:bg-white/5"
                onClick={() => chat.setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[190px_1fr]">
              <aside className="hidden border-r border-primary/10 p-3 md:block">
                <div className="mb-3 flex items-center justify-between">
                  <strong className="text-xs text-primary/70">{copy.chat.history}</strong>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-primary/15 px-2 py-1 text-[11px] text-primary/70 hover:text-primary"
                    onClick={chat.newSession}
                  >
                    <Plus className="h-3 w-3" />
                    {copy.chat.fresh}
                  </button>
                </div>
                <div className="space-y-1 overflow-auto">
                  {chat.sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => void chat.openSession(session.id)}
                      className={cn(
                        'w-full rounded-lg px-2.5 py-2 text-left text-xs text-gray-400 hover:bg-white/5 hover:text-primary',
                        session.id === chat.sessionId && 'bg-[#212121] text-[#E1E0CC]',
                      )}
                    >
                      <span className="block truncate">{session.title}</span>
                      <small className="block text-gray-500">
                        {new Date(session.updatedAt).toLocaleDateString(locale)}
                      </small>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="flex min-h-0 flex-col p-4">
                <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-auto pr-1" aria-live="polite">
                  {!chat.messages.length ? (
                    <div className="mt-[20vh] text-center text-sm text-gray-500">{copy.chat.empty}</div>
                  ) : null}
                  {chat.messages.map((message, index) => (
                    <article
                      key={message.id || index}
                      className={cn(
                        'max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                        message.role === 'user'
                          ? 'ml-auto bg-primary text-black'
                          : 'bg-[#212121] text-[#E1E0CC]',
                      )}
                    >
                      <div>
                        {message.content}
                        {chat.busy && index === chat.messages.length - 1 ? (
                          <span className="ml-0.5 inline-block animate-pulse text-primary">▋</span>
                        ) : null}
                      </div>
                      {message.tools?.map((tool) => (
                        <details key={tool.name} className="mt-2 text-xs text-gray-500">
                          <summary>{tool.name}</summary>
                          <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                            {JSON.stringify(tool.data, null, 2)}
                          </pre>
                        </details>
                      ))}
                    </article>
                  ))}
                </div>

                {chat.error ? <p className="mt-2 text-xs text-rose-400">{chat.error}</p> : null}

                <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={copy.chat.placeholder}
                    rows={2}
                    className="min-h-[64px] flex-1 resize-none rounded-2xl border border-primary/15 bg-[#212121] px-4 py-3 text-sm text-[#E1E0CC] outline-none placeholder:text-gray-500 focus:border-primary/30"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        void onSubmit(event as unknown as FormEvent);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={chat.busy || !input.trim()}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-black disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                    {copy.chat.send}
                  </button>
                </form>
              </section>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
