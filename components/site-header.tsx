'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { LocaleToggle } from './locale-toggle';
import { AiPlugin } from './chat/ai-plugin';
import { MagneticLogoText } from './animated-text';

export function SiteHeader() {
  const t = useTranslations('nav');
  const cmd = useTranslations('cmdk');
  const locale = useLocale();
  const base = `/${locale}`;
  const [isMac, setIsMac] = React.useState(true);
  const [condensed, setCondensed] = React.useState(false);
  React.useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onScroll = () => setCondensed(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const openPalette = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('cmdk:open'));
  }, []);

  const navItems: Array<{ href: string; key: 'home' | 'projects' | 'experience' | 'blog' }> = [
    { href: `${base}`, key: 'home' },
    { href: `${base}#projects`, key: 'projects' },
    { href: `${base}#experience`, key: 'experience' },
    { href: `${base}/blog`, key: 'blog' },
  ];

  return (
    <header className="sticky top-4 z-40 mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-10 xl:px-12">
      <div
        className={cn(
          'glass-strong flex items-center justify-between gap-3 rounded-full px-3 transition-[padding,background-color,backdrop-filter] duration-300 sm:px-5',
          condensed
            ? 'py-1.5 backdrop-saturate-150 bg-white/85 dark:bg-slate-950/75'
            : 'py-2',
        )}
      >
        <Link href={base} className="flex items-center gap-2 pl-1">
          <MagneticLogoText>gutsyang</MagneticLogoText>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/40 hover:text-foreground dark:hover:bg-white/10"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openPalette}
            aria-label={cmd('trigger')}
            className="hidden h-9 items-center gap-2 rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] px-3 text-xs text-muted-foreground transition-colors hover:bg-white/60 dark:hover:bg-white/[0.08] sm:inline-flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="font-mono uppercase tracking-widest">{cmd('trigger')}</span>
            <kbd className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono text-[10px]">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
          <button
            type="button"
            onClick={openPalette}
            aria-label={cmd('trigger')}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] text-muted-foreground transition-colors hover:bg-white/60 dark:hover:bg-white/[0.08] sm:hidden"
          >
            <Search className="h-4 w-4" />
          </button>
          <AiPlugin />
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
