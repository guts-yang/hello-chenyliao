'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { LocaleToggle } from './locale-toggle';
import { AiPlugin } from './chat/ai-plugin';
import { MagneticLogoText } from './animated-text';

export function SiteHeader() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const base = `/${locale}`;
  const [condensed, setCondensed] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems: Array<{ href: string; key: 'home' | 'projects' | 'experience' }> = [
    { href: `${base}`, key: 'home' },
    { href: `${base}#projects`, key: 'projects' },
    { href: `${base}#experience`, key: 'experience' },
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
          <AiPlugin />
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
