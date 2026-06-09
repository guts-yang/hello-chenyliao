import * as React from 'react';
import { Badge } from '@/components/ui/badge';

export function DetailHero({
  eyebrow,
  title,
  tagline,
  meta,
  tags,
  actions,
  metrics,
  transitionName,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  tagline?: string;
  meta?: React.ReactNode;
  tags?: string[];
  actions?: React.ReactNode;
  metrics?: Array<{ label: string; value: React.ReactNode }>;
  transitionName?: string;
}) {
  return (
    <header className="space-y-5">
      {eyebrow && (
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground/90">
          {eyebrow}
        </div>
      )}
      <h1
        className="display-headline text-balance text-4xl text-gradient sm:text-5xl md:text-6xl"
        style={transitionName ? { viewTransitionName: transitionName } : undefined}
      >
        {title}
      </h1>
      {tagline && (
        <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">{tagline}</p>
      )}
      {meta && <div className="text-sm text-muted-foreground">{meta}</div>}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} tone="muted">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      {actions && <div className="flex flex-wrap gap-3 pt-1">{actions}</div>}
      {metrics && metrics.length > 0 && (
        <dl className="grid gap-3 pt-2 sm:grid-cols-3">
          {metrics.map((m, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] px-4 py-3 backdrop-blur-md"
            >
              <dt className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {m.label}
              </dt>
              <dd className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
