import { setRequestLocale } from 'next-intl/server';
import { ContactForm } from '@/components/contact/contact-form';
import { getProfile } from '@/lib/content';
import { locales, type Locale } from '@/i18n';
import type { Metadata } from 'next';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  return {
    title: locale === 'zh' ? '联系' : 'Contact',
  };
}

export default async function ContactPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const profile = await getProfile();
  const locale = params.locale as Locale;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-2 sm:px-6 lg:px-10">
      <header className="space-y-3 py-8">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {locale === 'zh' ? '联系' : 'Contact'}
        </p>
        <h1 className="display-headline text-4xl text-gradient sm:text-5xl">
          {locale === 'zh' ? '直接打招呼' : 'Say hello'}
        </h1>
        <p className="text-base text-muted-foreground">
          {locale === 'zh'
            ? `也可以通过 ${profile.socials
                .filter((s) => s.type === 'email' || s.type === 'github')
                .map((s) => s.type)
                .join(' / ')} 找到我。`
            : `Or reach me via ${profile.socials
                .filter((s) => s.type === 'email' || s.type === 'github')
                .map((s) => s.type)
                .join(' / ')}.`}
        </p>
      </header>

      <ContactForm />
    </div>
  );
}
