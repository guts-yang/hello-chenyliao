'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { TocEntry } from '@/lib/mdx';

export function TocSidebar({ entries, title }: { entries: TocEntry[]; title: string }) {
  const [activeId, setActiveId] = React.useState<string | null>(entries[0]?.id ?? null);

  React.useEffect(() => {
    if (entries.length === 0) return;
    const observer = new IntersectionObserver(
      (ev) => {
        // Pick the first heading that is currently visible in the upper half.
        const visible = ev
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: '-15% 0px -65% 0px', threshold: [0, 1] },
    );
    for (const e of entries) {
      const el = document.getElementById(e.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length < 2) return null;

  return (
    <nav aria-label={title} className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 lg:block">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80">{title}</p>
      <ol className="mt-3 space-y-1 border-l border-border/60">
        {entries.map((entry) => (
          <li key={entry.id} className={cn(entry.level === 3 && 'ml-3')}>
            <a
              href={`#${entry.id}`}
              className={cn(
                '-ml-px flex items-center gap-2 border-l py-1 pl-3 text-xs leading-relaxed transition-colors',
                activeId === entry.id
                  ? 'border-[hsl(var(--primary))] font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
