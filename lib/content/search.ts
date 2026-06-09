import 'server-only';
import { pickLocale, type Locale } from '@/lib/profile';
import { getExperiences, getPosts, getProjects } from './readers';
import type { SearchHit } from './types';

/**
 * Unified search across projects + experiences + posts. The implementation is
 * intentionally simple (substring + token scoring) so it works without a live
 * Supabase project; once pgvector is populated, callers can switch to the
 * server-side retriever in lib/ai/retriever.ts instead.
 */
export async function searchAll(query: string, locale: Locale, limit = 12): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const needle = trimmed.toLowerCase();
  const tokens = needle.split(/\s+/).filter(Boolean);

  const [projects, experiences, posts] = await Promise.all([
    getProjects(),
    getExperiences(),
    getPosts(),
  ]);

  const hits: SearchHit[] = [];

  for (const p of projects) {
    const text = [
      p.title.zh,
      p.title.en,
      p.tagline.zh,
      p.tagline.en,
      p.summary.zh,
      p.summary.en,
      p.tags.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    const score = scoreText(text, needle, tokens);
    if (score > 0) {
      hits.push({
        scope: 'project',
        slug: p.slug,
        title: p.title,
        excerpt: p.tagline,
        href: `/${locale}/projects/${p.slug}`,
        score,
      });
    }
  }

  for (const e of experiences) {
    const text = [e.org.zh, e.org.en, e.role.zh, e.role.en, e.summary.zh, e.summary.en]
      .join(' ')
      .toLowerCase();
    const score = scoreText(text, needle, tokens);
    if (score > 0) {
      hits.push({
        scope: 'experience',
        slug: e.slug,
        title: e.org,
        excerpt: e.role,
        href: `/${locale}/experience/${e.slug}`,
        score,
      });
    }
  }

  for (const post of posts) {
    const text = [
      post.title.zh,
      post.title.en,
      post.excerpt.zh,
      post.excerpt.en,
      post.tags.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    const score = scoreText(text, needle, tokens);
    if (score > 0) {
      hits.push({
        scope: 'post',
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        href: `/${locale}/posts/${post.slug}`,
        score,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

function scoreText(haystack: string, needle: string, tokens: string[]): number {
  let score = 0;
  if (haystack.includes(needle)) score += 4;
  for (const t of tokens) {
    if (!t) continue;
    const occurrences = haystack.split(t).length - 1;
    if (occurrences > 0) score += Math.min(occurrences, 3);
  }
  return score;
}

/**
 * Helper for callers that just want to render a localized excerpt.
 */
export function hitExcerpt(hit: SearchHit, locale: Locale): string {
  return pickLocale(hit.excerpt, locale);
}
