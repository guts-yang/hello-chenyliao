import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

type Item = { href: string; title: string; subtitle?: string };

export function PrevNext({
  prev,
  next,
  labels,
}: {
  prev?: Item | null;
  next?: Item | null;
  labels: { prev: string; next: string };
}) {
  if (!prev && !next) return null;
  return (
    <nav className="mt-12 grid gap-3 border-t border-border/60 pt-8 sm:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="group block rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/[0.03] p-4 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.5)]"
        >
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            <ArrowLeft className="h-3 w-3" />
            {labels.prev}
          </p>
          {prev.subtitle && (
            <p className="mt-1.5 text-xs text-muted-foreground">{prev.subtitle}</p>
          )}
          <p className="mt-1 text-sm font-medium text-foreground">{prev.title}</p>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group block rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/[0.03] p-4 text-right backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.5)]"
        >
          <p className="flex items-center justify-end gap-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {labels.next}
            <ArrowRight className="h-3 w-3" />
          </p>
          {next.subtitle && (
            <p className="mt-1.5 text-xs text-muted-foreground">{next.subtitle}</p>
          )}
          <p className="mt-1 text-sm font-medium text-foreground">{next.title}</p>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
