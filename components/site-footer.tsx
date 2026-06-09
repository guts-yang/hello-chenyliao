import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Rss } from 'lucide-react';

export function SiteFooter() {
  const t = useTranslations('footer');
  const locale = useLocale();
  return (
    <footer className="mx-auto mt-24 w-full max-w-screen-2xl px-4 pb-10 pt-12 text-center text-xs text-muted-foreground sm:px-6 lg:px-10 xl:px-12">
      <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link href={`/${locale}/blog`} className="hover:text-foreground">
          {locale === 'zh' ? '博客' : 'Blog'}
        </Link>
        <Link href={`/${locale}/contact`} className="hover:text-foreground">
          {locale === 'zh' ? '联系' : 'Contact'}
        </Link>
        <a
          href={`/api/feed.xml?lang=${locale}`}
          className="inline-flex items-center gap-1 hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Rss className="h-3 w-3" />
          RSS
        </a>
      </nav>
      <p className="mt-4">{t('made')}</p>
      <p className="mt-1">{t('copyright', { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
