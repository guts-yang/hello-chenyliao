import { NextRequest } from 'next/server';
import { getPosts, getProfile } from '@/lib/content';
import { pickLocale } from '@/lib/profile';
import type { Locale } from '@/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const locale = (req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'zh') as Locale;
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`)
    .replace(/\/$/, '');

  const [profile, posts] = await Promise.all([getProfile(), getPosts()]);
  const name = locale === 'zh' ? profile.nameZh : profile.nameEn;

  const body = {
    version: 'https://jsonfeed.org/version/1.1',
    title: `${name} — ${locale === 'zh' ? '博客' : 'Writing'}`,
    home_page_url: `${base}/${locale}/blog`,
    feed_url: `${base}/api/feed.json?lang=${locale}`,
    description: pickLocale(profile.slogan, locale),
    language: locale === 'zh' ? 'zh-CN' : 'en-US',
    authors: [
      {
        name,
        url: `${base}/${locale}`,
      },
    ],
    items: posts
      .filter((p) => p.publishedAt)
      .map((post) => {
        const url = `${base}/${locale}/posts/${post.slug}`;
        return {
          id: url,
          url,
          title: pickLocale(post.title, locale),
          summary: pickLocale(post.excerpt, locale),
          content_text: pickLocale(post.excerpt, locale),
          date_published: post.publishedAt!,
          tags: post.tags,
        };
      }),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/feed+json; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=86400',
    },
  });
}
