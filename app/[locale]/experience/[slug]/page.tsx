import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Briefcase } from 'lucide-react';
import { DetailLayout } from '@/components/detail/detail-layout';
import { DetailHero } from '@/components/detail/detail-hero';
import { PrevNext } from '@/components/detail/prev-next';
import { ViewCounter } from '@/components/detail/view-counter';
import { pickLocale } from '@/lib/profile';
import { getExperiences, getExperienceBySlug } from '@/lib/content';
import { formatDate } from '@/lib/utils';
import { locales, type Locale } from '@/i18n';
import type { TocEntry } from '@/lib/mdx';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  const experiences = await getExperiences();
  return locales.flatMap((locale) =>
    experiences.map((e) => ({ locale, slug: e.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const exp = await getExperienceBySlug(params.slug);
  if (!exp) return {};
  const locale = params.locale as Locale;
  return {
    title: pickLocale(exp.org, locale),
    description: pickLocale(exp.summary, locale),
    openGraph: {
      images: [`/api/og/experience/${exp.slug}?lang=${locale}`],
    },
  };
}

export default async function ExperienceDetailPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(params.locale);
  const exp = await getExperienceBySlug(params.slug);
  if (!exp) notFound();

  const locale = params.locale as Locale;
  const experiences = await getExperiences();
  const idx = experiences.findIndex((e) => e.slug === exp.slug);
  const prev = idx > 0 ? experiences[idx - 1] : null;
  const next = idx >= 0 && idx < experiences.length - 1 ? experiences[idx + 1] : null;

  const toc: TocEntry[] = [
    { id: 'summary', level: 2, text: locale === 'zh' ? '概述' : 'Summary' },
    ...(exp.metrics.length
      ? [
          {
            id: 'metrics',
            level: 2 as const,
            text: locale === 'zh' ? '量化成果' : 'Outcomes',
          },
        ]
      : []),
  ];

  return (
    <DetailLayout
      toc={toc}
      tocTitle={locale === 'zh' ? '目录' : 'On this page'}
      hero={
        <DetailHero
          eyebrow={
            <span className="inline-flex items-center gap-2">
              <Briefcase className="h-3 w-3" />
              {formatDate(exp.startedAt, locale)} —{' '}
              {exp.endedAt
                ? formatDate(exp.endedAt, locale)
                : locale === 'zh'
                  ? '至今'
                  : 'Present'}
            </span>
          }
          title={pickLocale(exp.org, locale)}
          tagline={pickLocale(exp.role, locale)}
          transitionName={`experience-title-${exp.slug}`}
          meta={<ViewCounter scope="experience" id={exp.slug} />}
        />
      }
      footer={
        <PrevNext
          labels={{
            prev: locale === 'zh' ? '上一段' : 'Previous',
            next: locale === 'zh' ? '下一段' : 'Next',
          }}
          prev={
            prev
              ? {
                  href: `/${locale}/experience/${prev.slug}`,
                  title: pickLocale(prev.org, locale),
                  subtitle: pickLocale(prev.role, locale),
                }
              : null
          }
          next={
            next
              ? {
                  href: `/${locale}/experience/${next.slug}`,
                  title: pickLocale(next.org, locale),
                  subtitle: pickLocale(next.role, locale),
                }
              : null
          }
        />
      }
    >
      <section id="summary" className="space-y-2 scroll-mt-28">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          {locale === 'zh' ? '概述' : 'Summary'}
        </h2>
        <p className="text-base leading-relaxed text-foreground/90">
          {pickLocale(exp.summary, locale)}
        </p>
      </section>

      {exp.metrics.length > 0 && (
        <section id="metrics" className="space-y-3 scroll-mt-28">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            {locale === 'zh' ? '量化成果' : 'Outcomes'}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {exp.metrics.map((m, i) => (
              <li
                key={i}
                className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4 text-sm"
              >
                {pickLocale(m, locale)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </DetailLayout>
  );
}
