import { NextRequest } from 'next/server';
import { getPosts, getProfile } from '@/lib/content';
import { pickLocale } from '@/lib/profile';
import type { Locale } from '@/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(req: NextRequest) {
  const locale = (req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'zh') as Locale;
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`)
    .replace(/\/$/, '');

  const [profile, posts] = await Promise.all([getProfile(), getPosts()]);
  const name = locale === 'zh' ? profile.nameZh : profile.nameEn;
  const channelTitle = `${name} — ${locale === 'zh' ? '博客' : 'Writing'}`;
  const channelDesc = pickLocale(profile.slogan, locale);

  const items = posts
    .filter((p) => p.publishedAt)
    .map((post) => {
      const url = `${base}/${locale}/posts/${post.slug}`;
      const title = pickLocale(post.title, locale);
      const description = pickLocale(post.excerpt, locale);
      const pubDate = new Date(post.publishedAt!).toUTCString();
      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
      ${post.tags.map((t) => `<category>${escapeXml(t)}</category>`).join('')}
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${base}/${locale}/blog</link>
    <description>${escapeXml(channelDesc)}</description>
    <language>${locale === 'zh' ? 'zh-CN' : 'en-US'}</language>
    <atom:link href="${base}/api/feed.xml?lang=${locale}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=86400',
    },
  });
}
