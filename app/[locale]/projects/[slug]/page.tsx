import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Github, ExternalLink } from 'lucide-react';
import { DetailLayout } from '@/components/detail/detail-layout';
import { DetailHero } from '@/components/detail/detail-hero';
import { PrevNext } from '@/components/detail/prev-next';
import { pickLocale } from '@/lib/profile';
import { getProjects, getProjectBySlug } from '@/lib/content';
import { formatDate } from '@/lib/utils';
import { locales, type Locale } from '@/i18n';
import type { TocEntry } from '@/components/detail/toc-sidebar';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  const projects = await getProjects();
  return locales.flatMap((locale) =>
    projects.map((p) => ({ locale, slug: p.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return {};
  const locale = rawLocale as Locale;
  return {
    title: pickLocale(project.title, locale),
    description: pickLocale(project.tagline, locale),
    openGraph: {
      images: [`/api/og/project/${project.slug}?lang=${locale}`],
    },
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  setRequestLocale(rawLocale);
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const locale = rawLocale as Locale;
  const t = await getTranslations({ locale, namespace: 'sections.projects' });
  const projects = await getProjects();
  const idx = projects.findIndex((p) => p.slug === project.slug);
  const prev = idx > 0 ? projects[idx - 1] : null;
  const next = idx >= 0 && idx < projects.length - 1 ? projects[idx + 1] : null;

  const stackEntries = Object.entries(project.stack ?? {}).filter(
    (entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0,
  );
  const gallery = project.gallery ?? [];

  const toc: TocEntry[] = [
    { id: 'overview', level: 2, text: locale === 'zh' ? '概述' : 'Overview' },
    ...(project.highlights.length
      ? [
          {
            id: 'highlights',
            level: 2 as const,
            text: locale === 'zh' ? '核心亮点' : 'Key Results',
          },
        ]
      : []),
    ...(stackEntries.length
      ? [{ id: 'stack', level: 2 as const, text: locale === 'zh' ? '技术栈' : 'Tech Stack' }]
      : []),
    ...(gallery.length
      ? [{ id: 'gallery', level: 2 as const, text: locale === 'zh' ? '画廊' : 'Gallery' }]
      : []),
  ];

  return (
    <DetailLayout
      toc={toc}
      tocTitle={locale === 'zh' ? '目录' : 'On this page'}
      hero={
        <DetailHero
          eyebrow={project.kind === 'academic' ? t('academic') : t('engineering')}
          title={pickLocale(project.title, locale)}
          tagline={pickLocale(project.tagline, locale)}
          transitionName={`project-title-${project.slug}`}
          meta={
            <span className="inline-flex flex-wrap items-center gap-3">
              <span>
                {formatDate(project.startedAt, locale)}
                {project.endedAt ? ` — ${formatDate(project.endedAt, locale)}` : ''}
              </span>
            </span>
          }
          tags={project.tags}
          actions={
            project.repo || project.link ? (
              <>
                {project.repo && (
                  <a
                    href={project.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur-md transition-all hover:-translate-y-0.5"
                  >
                    <Github className="h-4 w-4" />
                    Source
                  </a>
                )}
                {project.link && (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] backdrop-blur-md transition-all hover:-translate-y-0.5"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Live
                  </a>
                )}
              </>
            ) : null
          }
        />
      }
      footer={
        <PrevNext
          labels={{
            prev: locale === 'zh' ? '上一篇' : 'Previous',
            next: locale === 'zh' ? '下一篇' : 'Next',
          }}
          prev={
            prev
              ? {
                  href: `/${locale}/projects/${prev.slug}`,
                  title: pickLocale(prev.title, locale),
                  subtitle: pickLocale(prev.tagline, locale),
                }
              : null
          }
          next={
            next
              ? {
                  href: `/${locale}/projects/${next.slug}`,
                  title: pickLocale(next.title, locale),
                  subtitle: pickLocale(next.tagline, locale),
                }
              : null
          }
        />
      }
    >
      <section id="overview" className="space-y-2 scroll-mt-28">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          {locale === 'zh' ? '概述' : 'Overview'}
        </h2>
        <p className="text-base leading-relaxed text-foreground/90">
          {pickLocale(project.summary, locale)}
        </p>
      </section>

      {project.highlights.length > 0 && (
        <section id="highlights" className="space-y-3 scroll-mt-28">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            {locale === 'zh' ? '核心亮点' : 'Key Results'}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {project.highlights.map((h, i) => (
              <li
                key={i}
                className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4 text-sm"
              >
                {pickLocale(h, locale)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {stackEntries.length > 0 && (
        <section id="stack" className="space-y-3 scroll-mt-28">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            {locale === 'zh' ? '技术栈' : 'Tech Stack'}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {stackEntries.map(([category, items]) => (
              <div key={category} className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4">
                <dt className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {category}
                </dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {items.map((it) => (
                    <span
                      key={it}
                      className="rounded-full border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/[0.05] px-2.5 py-1 text-xs font-mono text-foreground/85"
                    >
                      {it}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {gallery.length > 0 && (
        <section id="gallery" className="space-y-3 scroll-mt-28">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            {locale === 'zh' ? '画廊' : 'Gallery'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {gallery.map((g, i) => (
              <figure key={i} className="overflow-hidden rounded-2xl border border-white/40 dark:border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.url}
                  alt={(locale === 'zh' ? g.caption_zh : g.caption_en) ?? ''}
                  className="aspect-video w-full object-cover"
                />
                {(g.caption_zh || g.caption_en) && (
                  <figcaption className="px-3 py-2 text-xs text-muted-foreground">
                    {locale === 'zh' ? g.caption_zh ?? g.caption_en : g.caption_en ?? g.caption_zh}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}
    </DetailLayout>
  );
}
