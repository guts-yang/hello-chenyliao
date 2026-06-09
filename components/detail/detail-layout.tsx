import * as React from 'react';
import { BackLink } from '@/components/back-link';
import { ReadingProgress } from './reading-progress';
import { TocSidebar } from './toc-sidebar';
import type { TocEntry } from '@/lib/mdx';

/**
 * Shared layout shell for project / experience / blog post detail pages.
 *
 *   ┌────────────────────────────┐   ← ReadingProgress (fixed, 2px)
 *   │   BackLink                 │
 *   │   <Hero> (full-bleed)      │
 *   ├──────────┬─────────────────┤
 *   │   TOC    │   children      │   ← TOC only renders on >= lg with >=2 entries
 *   ├──────────┴─────────────────┤
 *   │   <Footer prev/next>       │
 *   └────────────────────────────┘
 */
export function DetailLayout({
  hero,
  toc = [],
  tocTitle,
  children,
  footer,
  containerClassName,
}: {
  hero: React.ReactNode;
  toc?: TocEntry[];
  tocTitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  containerClassName?: string;
}) {
  return (
    <>
      <ReadingProgress />
      <div className={containerClassName ?? 'mx-auto w-full max-w-6xl px-4 pb-24 pt-2 sm:px-6 lg:px-10'}>
        <BackLink />
        <article className="mt-4 space-y-10">
          <section className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/[0.03] p-6 backdrop-blur-md sm:p-10">
            {hero}
          </section>

          <div className="grid gap-10 lg:grid-cols-[200px,minmax(0,1fr)] lg:gap-14">
            <TocSidebar entries={toc} title={tocTitle ?? 'On this page'} />
            <div className="min-w-0 space-y-8">{children}</div>
          </div>

          {footer}
        </article>
      </div>
    </>
  );
}
