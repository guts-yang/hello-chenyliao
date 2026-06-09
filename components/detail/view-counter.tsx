'use client';

import * as React from 'react';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Bumps the view counter once on mount (the server applies a per-visitor
 * rate-limit, so repeated reloads in a minute don't inflate the count) and
 * renders the latest number in a discreet pill.
 */
export function ViewCounter({ scope, id }: { scope: 'project' | 'experience' | 'post'; id: string }) {
  const t = useTranslations('views');
  const [count, setCount] = React.useState<number | null>(null);
  const sentRef = React.useRef(false);

  React.useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/views/${scope}/${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        });
        if (!res.ok) return;
        const json = (await res.json()) as { count?: number };
        if (!cancelled && typeof json.count === 'number') setCount(json.count);
      } catch {
        // soft-fail: do not surface errors for a counter
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, id]);

  if (count == null || count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
      <Eye className="h-3 w-3" />
      {t('label', { count })}
    </span>
  );
}
