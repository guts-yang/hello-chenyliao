import { NextRequest, NextResponse } from 'next/server';
import { searchAll } from '@/lib/content';
import { pickLocale, type Locale } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const locale = (req.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'zh') as Locale;
  const limit = Math.min(20, Number(req.nextUrl.searchParams.get('limit') ?? '12') || 12);

  if (!q) return NextResponse.json({ hits: [] });
  const hits = await searchAll(q, locale, limit);

  // Project shape down to what the UI actually consumes.
  return NextResponse.json({
    hits: hits.map((h) => ({
      scope: h.scope,
      slug: h.slug,
      href: h.href,
      title: pickLocale(h.title, locale),
      excerpt: pickLocale(h.excerpt, locale),
      score: h.score,
    })),
  });
}
