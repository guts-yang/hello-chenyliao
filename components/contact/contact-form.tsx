'use client';

import * as React from 'react';
import { Send, Loader2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Status = 'idle' | 'sending' | 'ok' | 'rate' | 'err';

export function ContactForm() {
  const t = useTranslations('contact');
  const [status, setStatus] = React.useState<Status>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus('sending');
    setErrorMessage('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(fd.get('name') ?? ''),
          email: String(fd.get('email') ?? ''),
          topic: String(fd.get('topic') ?? ''),
          message: String(fd.get('message') ?? ''),
          hp: String(fd.get('hp') ?? ''),
        }),
      });
      if (res.status === 429) {
        setStatus('rate');
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setStatus('err');
        setErrorMessage(typeof json?.error === 'string' ? json.error : '');
        return;
      }
      setStatus('ok');
      e.currentTarget.reset();
    } catch (err) {
      setStatus('err');
      setErrorMessage(err instanceof Error ? err.message : 'unknown');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] p-6 backdrop-blur-md"
    >
      <header className="space-y-1">
        <h2 className="display-headline text-2xl text-gradient">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground/80">{t('name')}</span>
          <input
            type="text"
            name="name"
            required
            minLength={1}
            maxLength={80}
            className="h-10 w-full rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 text-sm outline-none focus:border-[hsl(var(--primary)/0.5)]"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground/80">{t('email')}</span>
          <input
            type="email"
            name="email"
            required
            maxLength={160}
            className="h-10 w-full rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 text-sm outline-none focus:border-[hsl(var(--primary)/0.5)]"
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-foreground/80">{t('topic')}</span>
        <input
          type="text"
          name="topic"
          maxLength={120}
          className="h-10 w-full rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 text-sm outline-none focus:border-[hsl(var(--primary)/0.5)]"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-foreground/80">{t('message')}</span>
        <textarea
          name="message"
          rows={5}
          required
          minLength={4}
          maxLength={4000}
          className="w-full rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 py-2 text-sm outline-none focus:border-[hsl(var(--primary)/0.5)]"
        />
      </label>

      {/* Honeypot — must remain visually hidden but visible to dumb bots */}
      <label className="hidden" aria-hidden="true">
        Website
        <input type="text" name="hp" tabIndex={-1} autoComplete="off" />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-all hover:-translate-y-0.5 disabled:opacity-50"
        >
          {status === 'sending' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === 'ok' ? (
            <Check className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {status === 'sending' ? t('sending') : t('send')}
        </button>
        {status === 'ok' && <span className="text-xs text-emerald-500">{t('ok')}</span>}
        {status === 'rate' && <span className="text-xs text-amber-500">{t('tooFast')}</span>}
        {status === 'err' && (
          <span className="text-xs text-rose-500" title={errorMessage}>
            {t('error')}
          </span>
        )}
      </div>
    </form>
  );
}
