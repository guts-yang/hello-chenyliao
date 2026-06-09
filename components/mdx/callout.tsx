import * as React from 'react';
import { Info, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'warn' | 'success' | 'tip';

const TONE: Record<
  Tone,
  { Icon: React.ComponentType<{ className?: string }>; ring: string; chip: string }
> = {
  info: {
    Icon: Info,
    ring: 'border-[hsl(var(--primary)/0.35)]',
    chip: 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]',
  },
  warn: {
    Icon: AlertTriangle,
    ring: 'border-[hsl(var(--destructive)/0.35)]',
    chip: 'bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]',
  },
  success: {
    Icon: CheckCircle2,
    ring: 'border-emerald-400/40',
    chip: 'bg-emerald-400/10 text-emerald-500',
  },
  tip: {
    Icon: Lightbulb,
    ring: 'border-amber-400/40',
    chip: 'bg-amber-400/10 text-amber-500',
  },
};

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
}) {
  const { Icon, ring, chip } = TONE[tone];
  return (
    <div
      className={cn(
        'not-prose my-6 flex gap-3 rounded-2xl border bg-white/40 dark:bg-white/[0.03] p-4 backdrop-blur-md',
        ring,
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          chip,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 space-y-1 text-sm leading-relaxed">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        <div className="text-foreground/85 [&>p]:my-1">{children}</div>
      </div>
    </div>
  );
}
