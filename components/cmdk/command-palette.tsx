'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Command } from 'cmdk';
import {
  ArrowRight,
  Briefcase,
  FolderGit2,
  Home,
  NotebookText,
  Search,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Hit = {
  scope: 'project' | 'experience' | 'post';
  slug: string;
  title: string;
  excerpt: string;
  href: string;
};

const SCOPE_ICON: Record<Hit['scope'], React.ComponentType<{ className?: string }>> = {
  project: FolderGit2,
  experience: Briefcase,
  post: NotebookText,
};

/**
 * Spotlight-style command palette. Opens with ⌘K / Ctrl+K; the input drives a
 * remote search hitting /api/search. The "Ask AI" suggestion redirects to the
 * AI chat dock with the current query pre-loaded.
 *
 * The palette is mounted once at the layout level and listens to a global
 * "cmdk:open" event so any UI element (header, AI dock, mobile menu) can open
 * it without prop-drilling.
 */
export function CommandPalette() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('cmdk');
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === '/' && !isTyping(e.target)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('cmdk:open', onCustom);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('cmdk:open', onCustom);
    };
  }, []);

  // Debounced server search.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length === 0) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error('search failed');
        const json = (await res.json()) as { hits: Hit[] };
        setHits(json.hits);
      } catch {
        // ignore aborts / network errors
      } finally {
        setLoading(false);
      }
    }, 140);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [query, locale, open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function askAi() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('ai-plugin:open', { detail: { prompt: query } }));
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t('label')}
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 sm:p-10"
      shouldFilter={false}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/30 backdrop-blur-md"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-[61] mt-[10vh] w-full max-w-xl overflow-hidden rounded-3xl border border-white/40 dark:border-white/10 bg-white/85 dark:bg-[hsl(var(--card)/0.92)] shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center gap-3 border-b border-white/40 dark:border-white/10 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={t('placeholder')}
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {!query && (
            <Command.Group heading={t('suggestions')}>
              <PaletteItem
                Icon={Home}
                title={t('goHome')}
                onSelect={() => go(`/${locale}`)}
              />
              <PaletteItem
                Icon={FolderGit2}
                title={t('goProjects')}
                onSelect={() => go(`/${locale}#projects`)}
              />
              <PaletteItem
                Icon={NotebookText}
                title={t('goBlog')}
                onSelect={() => go(`/${locale}/blog`)}
              />
              <PaletteItem
                Icon={Sparkles}
                title={t('askAi')}
                onSelect={askAi}
              />
            </Command.Group>
          )}

          {loading && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t('loading')}
            </div>
          )}

          {query && !loading && hits.length === 0 && (
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t('empty')}
            </Command.Empty>
          )}

          {query && (
            <Command.Group heading={t('askAi')}>
              <PaletteItem
                Icon={Sparkles}
                title={`${t('askAi')} → "${query}"`}
                onSelect={askAi}
              />
            </Command.Group>
          )}

          {hits.length > 0 && (
            <Command.Group heading={t('results')}>
              {hits.map((hit) => {
                const Icon = SCOPE_ICON[hit.scope];
                return (
                  <PaletteItem
                    key={`${hit.scope}-${hit.slug}`}
                    Icon={Icon}
                    title={hit.title}
                    subtitle={hit.excerpt}
                    chip={hit.scope}
                    onSelect={() => go(hit.href)}
                  />
                );
              })}
            </Command.Group>
          )}
        </Command.List>

        <div className="flex items-center justify-between gap-2 border-t border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] px-4 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono">↑↓</kbd>
            {t('hintNavigate')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono">↵</kbd>
            {t('hintSelect')}
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}

function PaletteItem({
  Icon,
  title,
  subtitle,
  chip,
  onSelect,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  chip?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
        'data-[selected=true]:bg-[hsl(var(--primary)/0.1)] data-[selected=true]:text-foreground',
        'hover:bg-[hsl(var(--primary)/0.08)]',
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/60 dark:bg-white/[0.05] text-muted-foreground group-data-[selected=true]:text-[hsl(var(--primary))]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-foreground">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </span>
      {chip && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          {chip}
        </span>
      )}
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
