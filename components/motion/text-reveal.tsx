'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from './reduced-motion';

/**
 * Animates a string in word-by-word with a small upward fade. Use for hero
 * titles and section intros where the staccato rhythm reads as luxurious.
 *
 * Tokens are split by spaces; CJK strings stay as single tokens (which is
 * what we want — character-by-character reveal of Chinese feels gimmicky).
 */
export function TextReveal({
  children,
  as: As = 'span',
  className,
  delay = 0,
  stagger = 60,
}: {
  children: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const tokens = React.useMemo(() => splitForReveal(children), [children]);

  if (reduced) {
    return <As className={className}>{children}</As>;
  }

  return (
    <As className={cn('inline-block', className)}>
      {tokens.map((token, i) => (
        <span
          key={i}
          className="reveal-token inline-block"
          style={{
            animationDelay: `${delay + i * stagger}ms`,
          }}
        >
          {token}
        </span>
      ))}
    </As>
  );
}

function splitForReveal(input: string): string[] {
  // Keep Chinese characters as one unit per word-boundary; everything else
  // splits on whitespace while preserving the trailing space for layout.
  const out: string[] = [];
  const parts = input.split(/(\s+)/);
  for (const part of parts) {
    if (!part) continue;
    if (/\s+/.test(part)) {
      out.push(part);
    } else {
      // CJK heuristic: if it's all CJK characters, keep as a single token.
      if (/^[\u4e00-\u9fff，。！？、·]+$/.test(part)) {
        out.push(part);
      } else {
        out.push(part);
      }
    }
  }
  return out;
}
