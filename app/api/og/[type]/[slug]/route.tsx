import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import {
  getProfile,
  getProjectBySlug,
  getExperienceBySlug,
  getPostBySlug,
} from '@/lib/content';
import { pickLocale } from '@/lib/profile';
import type { Locale } from '@/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIZE = { width: 1200, height: 630 };

type OgType = 'project' | 'experience' | 'post' | 'home';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; slug: string }> },
) {
  const { type: rawType, slug } = await params;
  const type = (rawType as OgType) ?? 'home';
  const locale = (req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'zh') as Locale;

  const profile = await getProfile();

  let eyebrow = '';
  let title = '';
  let subtitle = '';

  if (type === 'project') {
    const p = await getProjectBySlug(slug);
    if (!p) return new Response('not found', { status: 404 });
    eyebrow = locale === 'zh' ? '项目' : 'PROJECT';
    title = pickLocale(p.title, locale);
    subtitle = pickLocale(p.tagline, locale);
  } else if (type === 'experience') {
    const e = await getExperienceBySlug(slug);
    if (!e) return new Response('not found', { status: 404 });
    eyebrow = locale === 'zh' ? '经历' : 'EXPERIENCE';
    title = pickLocale(e.org, locale);
    subtitle = pickLocale(e.role, locale);
  } else if (type === 'post') {
    const post = await getPostBySlug(slug);
    if (!post) return new Response('not found', { status: 404 });
    eyebrow = locale === 'zh' ? '博客' : 'WRITING';
    title = pickLocale(post.title, locale);
    subtitle = pickLocale(post.excerpt, locale);
  } else {
    eyebrow = profile.handle;
    title = locale === 'zh' ? `${profile.nameZh} · ${profile.nameEn}` : profile.nameEn;
    subtitle = pickLocale(profile.slogan, locale);
  }

  // Hard truncate long fields so they don't blow out the layout.
  const trimmedTitle = title.length > 96 ? `${title.slice(0, 96)}…` : title;
  const trimmedSubtitle = subtitle.length > 160 ? `${subtitle.slice(0, 160)}…` : subtitle;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          color: '#0f172a',
          background:
            'radial-gradient(circle at 14% 18%, rgba(59,130,246,0.32) 0%, transparent 56%),' +
            'radial-gradient(circle at 86% 24%, rgba(56,189,248,0.24) 0%, transparent 58%),' +
            'radial-gradient(circle at 60% 86%, rgba(125,211,252,0.28) 0%, transparent 56%),' +
            'linear-gradient(180deg, #f8fbff 0%, #eef7ff 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: -0.5,
              color: '#0f172a',
            }}
          >
            {profile.handle}.dev
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(15,98,254,0.12)',
              color: '#0f62fe',
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div
            style={{
              fontSize: title.length > 32 ? 72 : 88,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.05,
              color: '#0f172a',
              maxWidth: 1056,
            }}
          >
            {trimmedTitle}
          </div>
          {trimmedSubtitle && (
            <div style={{ fontSize: 30, color: '#475569', maxWidth: 1056, lineHeight: 1.3 }}>
              {trimmedSubtitle}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            color: '#475569',
          }}
        >
          <div>{locale === 'zh' ? profile.nameZh : profile.nameEn}</div>
          <div style={{ display: 'flex', gap: 18, textTransform: 'uppercase', letterSpacing: 2 }}>
            {profile.socials.slice(0, 3).map((s) => (
              <span key={s.type}>{s.type}</span>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...SIZE },
  );
}
