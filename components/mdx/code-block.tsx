import * as React from 'react';
import { CopyButton } from './copy-button';

/**
 * Server-rendered code block with line numbers + a client-only copy button.
 * Syntax highlighting is intentionally left out for now: the project ships
 * without shiki dependencies; tokens get a tasteful mono treatment via CSS.
 *
 * The MDX `pre` mapping rewrites <pre><code>...</code></pre> to <CodeBlock>
 * (see ./components.tsx), which also handles the ```ts {filename} fence sigil.
 */
type Props = {
  children: string;
  language?: string;
  filename?: string;
};

export function CodeBlock({ children, language, filename }: Props) {
  const code = String(children ?? '').replace(/\n$/, '');
  const lines = code.split('\n');
  return (
    <figure className="not-prose group relative my-6 overflow-hidden rounded-2xl border border-white/40 dark:border-white/10 bg-[hsl(var(--muted)/0.5)] dark:bg-[hsl(var(--card)/0.6)]">
      {(filename || language) && (
        <div className="flex items-center justify-between gap-3 border-b border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] px-4 py-2 text-xs">
          <span className="font-mono text-muted-foreground">
            {filename ? filename : language ? language.toUpperCase() : ''}
          </span>
          {language && filename && (
            <span className="font-mono uppercase tracking-widest text-muted-foreground/80">
              {language}
            </span>
          )}
        </div>
      )}
      <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto px-0 py-4 text-[13px] leading-relaxed">
        <code className="block font-mono">
          {lines.map((line, i) => (
            <span key={i} className="grid grid-cols-[3rem,1fr] hover:bg-white/40 dark:hover:bg-white/[0.02]">
              <span className="select-none px-4 text-right text-muted-foreground/60 tabular-nums">
                {i + 1}
              </span>
              <span className="whitespace-pre pr-4">{line || ' '}</span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
