/**
 * Pure DB-row -> model adapters. No I/O, easy to unit-test.
 */
import type {
  DbEducationRow,
  DbExperienceRow,
  DbHonorRow,
  DbNoteRow,
  DbPostRow,
  DbProfileRow,
  DbProjectRow,
  DbSiteSettingsRow,
  DbTimelineRow,
} from '@/lib/supabase/types';
import type {
  Education,
  Experience,
  Honor,
  Note,
  Post,
  ProfileBundle,
  Project,
  SiteSettings,
  TimelineEvent,
} from './types';

export function fromProjectRow(row: DbProjectRow): Project {
  return {
    slug: row.slug,
    kind: row.kind,
    title: { zh: row.title_zh, en: row.title_en },
    tagline: { zh: row.tagline_zh, en: row.tagline_en },
    summary: { zh: row.summary_zh, en: row.summary_en },
    tags: row.tags ?? [],
    highlights: row.highlights ?? [],
    link: row.link ?? undefined,
    repo: row.repo ?? undefined,
    cover: row.cover_url ?? undefined,
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    stack: row.stack ?? {},
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
  };
}

export function fromExperienceRow(row: DbExperienceRow): Experience {
  return {
    slug: row.slug,
    org: { zh: row.org_zh, en: row.org_en },
    role: { zh: row.role_zh, en: row.role_en },
    summary: { zh: row.summary_zh, en: row.summary_en },
    metrics: row.metrics ?? [],
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    link: row.link ?? undefined,
  };
}

export function fromHonorRow(row: DbHonorRow): Honor {
  return {
    pillar: row.pillar,
    title: { zh: row.title_zh, en: row.title_en },
    story: { zh: row.story_zh, en: row.story_en },
  };
}

export function fromEducationRow(row: DbEducationRow): Education {
  return {
    school: { zh: row.school_zh, en: row.school_en },
    degree: { zh: row.degree_zh, en: row.degree_en },
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    notes:
      row.notes_zh || row.notes_en
        ? { zh: row.notes_zh ?? '', en: row.notes_en ?? '' }
        : undefined,
  };
}

export function fromTimelineRow(row: DbTimelineRow): TimelineEvent {
  return {
    date: row.date,
    kind: row.kind,
    title: { zh: row.title_zh, en: row.title_en },
    body: { zh: row.body_zh, en: row.body_en },
    featured: Boolean(row.featured),
  };
}

export function fromProfileRow(row: DbProfileRow): ProfileBundle {
  return {
    nameZh: row.name_zh,
    nameEn: row.name_en,
    handle: row.handle,
    role: { zh: row.role_zh, en: row.role_en },
    slogan: { zh: row.slogan_zh, en: row.slogan_en },
    bio: { zh: row.bio_zh, en: row.bio_en },
    avatarUrl: row.avatar_url ?? undefined,
    socials: row.socials ?? [],
  };
}

export function fromPostRow(row: DbPostRow): Post {
  return {
    slug: row.slug,
    title: { zh: row.title_zh, en: row.title_en },
    excerpt: { zh: row.excerpt_zh, en: row.excerpt_en },
    body: { zh: row.body_zh, en: row.body_en },
    coverUrl: row.cover_url ?? undefined,
    tags: row.tags ?? [],
    readingMinutes: row.reading_minutes,
    publishedAt: row.published_at ?? undefined,
  };
}

export function fromNoteRow(row: DbNoteRow): Note {
  return {
    id: row.id,
    body: { zh: row.body_zh, en: row.body_en },
    mood: row.mood ?? undefined,
    createdAt: row.created_at,
  };
}

export function fromSiteSettingsRow(row: DbSiteSettingsRow): SiteSettings {
  return {
    hero: { zh: row.hero_zh, en: row.hero_en },
    ctaLabel: { zh: row.cta_label_zh, en: row.cta_label_en },
    themeTokens: row.theme_tokens ?? {},
    featureFlags: row.feature_flags ?? {},
  };
}
