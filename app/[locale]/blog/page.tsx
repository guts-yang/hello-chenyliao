import { setRequestLocale } from 'next-intl/server';
import { getPosts } from '@/lib/content';
import { pickLocale } from '@/lib/profile';
import { formatDate } from '@/lib/utils';
import { locales, type Locale } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { TransitionLink } from '@/components/transition-link';
import { Reveal } from '@/components/motion';
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
    title: locale === 'zh' ? '博客' : 'Blog',
    description:
      locale === 'zh'
        ? '工程实践、研究笔记与零散的灵感'
        : 'Engineering practice, research notes, and scattered ideas',
  };
}

export default async function BlogIndexPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const locale = params.locale as Locale;
  const posts = await getPosts();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-2 sm:px-6 lg:px-10">
      <header className="space-y-3 py-8">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {locale === 'zh' ? '博客' : 'Writing'}
        </p>
        <h1 className="display-headline text-4xl text-gradient sm:text-5xl">
          {locale === 'zh' ? '想法的连载' : 'Long-form notes'}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          {locale === 'zh'
            ? '我把比推文更长、比论文更随性的东西放在这里。'
            : 'Longer than a tweet, more candid than a paper. The middle drawer of my brain.'}
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-white/40 dark:bg-white/[0.02] p-10 text-center text-sm text-muted-foreground">
          {locale === 'zh'
            ? '草稿都还在脑子里 —— 关注 GitHub 等更新。'
            : 'Still cooking. Watch GitHub for fresh posts.'}
        </div>
      ) : (
        <ul className="grid gap-4">
          {posts.map((post, i) => (
            <Reveal key={post.slug} delay={i * 60} as="li">
              <TransitionLink
                href={`/${locale}/posts/${post.slug}`}
                className="group block rounded-3xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/[0.03] p-6 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.5)] hover:bg-white/60 dark:hover:bg-white/[0.05]"
                data-cursor="grow"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {post.publishedAt && <time>{formatDate(post.publishedAt, locale)}</time>}
                  <span>·</span>
                  <span>
                    {post.readingMinutes} {locale === 'zh' ? '分钟读' : 'min read'}
                  </span>
                </div>
                <h2
                  className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-[hsl(var(--primary))]"
                  style={{ viewTransitionName: `post-title-${post.slug}` }}
                >
                  {pickLocale(post.title, locale)}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pickLocale(post.excerpt, locale)}
                </p>
                {post.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {post.tags.map((t) => (
                      <Badge key={t} tone="muted">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </TransitionLink>
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}
