import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ThemeProvider } from '@/components/theme-provider';
import { AuroraBackground } from '@/components/aurora-background';
import { AuroraEffects } from '@/components/aurora-effects';
import { GlowCursor } from '@/components/glow-cursor';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { EasterEggs } from '@/components/easter-eggs';
import { CommandPalette } from '@/components/cmdk/command-palette';
import { locales, type Locale } from '@/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        zh: '/zh',
        en: '/en',
      },
      types: {
        'application/rss+xml': [
          { url: `/api/feed.xml?lang=${locale}`, title: `${t('title')} RSS` },
        ],
        'application/feed+json': [
          { url: `/api/feed.json?lang=${locale}`, title: `${t('title')} JSON Feed` },
        ],
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'website',
      url: `/${locale}`,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();

  // Required for next-intl static rendering
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <AuroraBackground />
        <AuroraEffects />
        <GlowCursor />
        <EasterEggs />
        <CommandPalette />
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1 pt-6">{children}</main>
          <SiteFooter />
        </div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
