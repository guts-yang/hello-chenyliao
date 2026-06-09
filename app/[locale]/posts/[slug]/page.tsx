import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { DetailLayout } from '@/components/detail/detail-layout';
import { DetailHero } from '@/components/detail/detail-hero';
import { PrevNext } from '@/components/detail/prev-next';
import { ViewCounter } from '@/components/detail/view-counter';
import { MdxContent } from '@/components/mdx/mdx-content';
import { getPostBySlug, getPosts } from '@/lib/content';
import { pickLocale } from '@/lib/profile';
import { formatDate } from '@/lib/utils';
import { extractToc } from '@/lib/mdx';
import { locales, type Locale } from '@/i18n';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  const posts = await getPosts();
  return locales.flatMap((locale) => posts.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) return {};
  const locale = params.locale as Locale;
  return {
    title: pickLocale(post.title, locale),
    description: pickLocale(post.excerpt, locale),
    openGraph: {
      type: 'article',
      title: pickLocale(post.title, locale),
      description: pickLocale(post.excerpt, locale),
      images: [`/api/og/post/${post.slug}?lang=${locale}`],
      publishedTime: post.publishedAt ?? undefined,
    },
  };
}

export default async function PostDetailPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(params.locale);
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  const locale = params.locale as Locale;
  const all = await getPosts();
  const idx = all.findIndex((p) => p.slug === post.slug);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const body = pickLocale(post.body, locale);
  const toc = extractToc(body);

  return (
    <DetailLayout
      toc={toc}
      tocTitle={locale === 'zh' ? '目录' : 'On this page'}
      hero={
        <DetailHero
          eyebrow={locale === 'zh' ? '博客' : 'Writing'}
          title={pickLocale(post.title, locale)}
          tagline={pickLocale(post.excerpt, locale)}
          transitionName={`post-title-${post.slug}`}
          meta={
            <span className="inline-flex flex-wrap items-center gap-3">
              {post.publishedAt && <span>{formatDate(post.publishedAt, locale)}</span>}
              <span>
                {post.readingMinutes} {locale === 'zh' ? '分钟阅读' : 'min read'}
              </span>
              <ViewCounter scope="post" id={post.slug} />
            </span>
          }
          tags={post.tags}
        />
      }
      footer={
        <PrevNext
          labels={{
            prev: locale === 'zh' ? '上一篇' : 'Previous post',
            next: locale === 'zh' ? '下一篇' : 'Next post',
          }}
          prev={
            prev
              ? {
                  href: `/${locale}/posts/${prev.slug}`,
                  title: pickLocale(prev.title, locale),
                  subtitle: pickLocale(prev.excerpt, locale),
                }
              : null
          }
          next={
            next
              ? {
                  href: `/${locale}/posts/${next.slug}`,
                  title: pickLocale(next.title, locale),
                  subtitle: pickLocale(next.excerpt, locale),
                }
              : null
          }
        />
      }
    >
      <MdxContent source={body} />
    </DetailLayout>
  );
}
