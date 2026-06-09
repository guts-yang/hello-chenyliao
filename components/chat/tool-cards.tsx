import * as React from 'react';
import { ArrowRight, FileDown, Briefcase, FolderGit2, NotebookText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// The shapes here mirror lib/ai/tools.ts ToolPayload. Re-declared on purpose:
// this file is shipped to the client and we don't want to import server-only
// modules transitively.
export type ToolPayload =
  | {
      kind: 'projects';
      items: Array<{ slug: string; title: string; tagline: string; href: string }>;
    }
  | {
      kind: 'posts';
      items: Array<{ slug: string; title: string; excerpt: string; href: string }>;
    }
  | {
      kind: 'experience';
      slug: string;
      org: string;
      role: string;
      summary: string;
      href: string;
    }
  | {
      kind: 'project';
      slug: string;
      title: string;
      tagline: string;
      summary: string;
      href: string;
    }
  | { kind: 'resume'; href: string; label: string }
  | { kind: 'error'; message: string };

export function ToolCard({ payload }: { payload: ToolPayload }) {
  switch (payload.kind) {
    case 'projects':
      return (
        <ToolList
          title="Projects"
          icon={FolderGit2}
          items={payload.items.map((p) => ({
            href: p.href,
            title: p.title,
            subtitle: p.tagline,
          }))}
        />
      );
    case 'posts':
      return (
        <ToolList
          title="Posts"
          icon={NotebookText}
          items={payload.items.map((p) => ({
            href: p.href,
            title: p.title,
            subtitle: p.excerpt,
          }))}
        />
      );
    case 'project':
      return (
        <ToolSingle
          icon={FolderGit2}
          title={payload.title}
          subtitle={payload.tagline}
          body={payload.summary}
          href={payload.href}
        />
      );
    case 'experience':
      return (
        <ToolSingle
          icon={Briefcase}
          title={payload.org}
          subtitle={payload.role}
          body={payload.summary}
          href={payload.href}
        />
      );
    case 'resume':
      return (
        <a
          href={payload.href}
          target="_blank"
          rel="noopener noreferrer"
          className="my-1 inline-flex items-center gap-2 rounded-2xl border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.08)] px-3 py-2 text-xs font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary)/0.14)]"
        >
          <FileDown className="h-3.5 w-3.5" />
          {payload.label}
        </a>
      );
    case 'error':
      return (
        <div className="my-1 inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-50/40 dark:bg-rose-500/[0.06] px-3 py-1.5 text-xs text-rose-500">
          <AlertCircle className="h-3.5 w-3.5" />
          {payload.message}
        </div>
      );
  }
}

function ToolList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{ href: string; title: string; subtitle: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="my-1.5 space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.href}>
            <a
              href={it.href}
              className={cn(
                'group flex items-start gap-2 rounded-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-3 py-2 text-xs transition-colors hover:border-[hsl(var(--primary)/0.5)] hover:bg-white/80',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {it.title}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {it.subtitle}
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToolSingle({
  icon: Icon,
  title,
  subtitle,
  body,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  body: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="my-1.5 block rounded-2xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] p-3 text-xs transition-colors hover:border-[hsl(var(--primary)/0.5)] hover:bg-white/80"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      {body && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {body}
        </p>
      )}
    </a>
  );
}
