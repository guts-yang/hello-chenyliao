'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  experienceRowToPayload,
  honorRowToPayload,
  profileRowToPayload,
  projectRowToPayload,
  requireAdminSession,
} from '@/lib/admin-api';
import type {
  DbExperienceRow,
  DbHonorRow,
  DbProfileRow,
  DbProjectRow,
  LocalizedJson,
  SocialJson,
} from '@/lib/api-types';
import { fetchBackend } from '@/lib/backend';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CONTENT_TAGS, type ContentTagName } from '@/lib/content';

type LocalizedRow = LocalizedJson;
import { optionalUrl } from '@/lib/admin-zod';
import type { AdminActionResult } from '@/lib/admin-action-result';
import { actionError } from '@/lib/admin-action-result';

function readFormString(fd: FormData, key: string, fallback = ''): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : fallback;
}

function readFormBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

function readFormJson<T = unknown>(fd: FormData, key: string, fallback: T): T {
  const v = fd.get(key);
  if (typeof v !== 'string' || v.trim() === '') return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  return supabase;
}

function bust(...tags: ContentTagName[]) {
  for (const t of tags) revalidateTag(t);
}

// EnsurePair is the unit of work for ensureEnglish: each entry maps a stable
// key (used only for the round-trip) to its current zh source + current en
// value. When `en` is empty but `zh` is not we ask the Go translate endpoint
// to fill the blank; otherwise we keep what the user (or AiTranslateBar)
// already supplied.
type EnsurePair = { key: string; zh: string; en: string };

// ensureEnglish is the server-side safety net for the "admin only types in
// Chinese" flow. Even if the admin forgets to click "AI 一键生成英文",
// we will not save a half-localised row -- this helper backfills every
// missing English field via /v1/admin/ai/translate before the row is
// persisted. Translation failures are non-fatal so a flaky DeepSeek does
// not block content updates: the worst case is an empty `en` field that
// the admin can re-translate later.
async function ensureEnglish(pairs: EnsurePair[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of pairs) out[p.key] = p.en;

  const missing: Record<string, string> = {};
  for (const p of pairs) {
    if (p.en.trim() === '' && p.zh.trim() !== '') {
      missing[p.key] = p.zh;
    }
  }
  if (Object.keys(missing).length === 0) return out;

  let response: Response;
  try {
    response = await fetchBackend(
      '/v1/admin/ai/translate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: missing }),
      },
      { auth: true, revalidate: false, timeoutMs: 30_000 },
    );
  } catch {
    return out;
  }
  if (response.ok) {
    const data = (await response.json().catch(() => ({}))) as { items?: Record<string, string> };
    const translated = data.items ?? {};
    for (const key of Object.keys(missing)) {
      if (translated[key]) out[key] = translated[key];
    }
  }
  // Last-resort fallback: if translation still left a required en blank, copy
  // the zh source over so downstream schema.parse(min(1)) does not reject the
  // whole save. The /en route will fall back to Chinese for that field, but
  // the row still persists and the admin can retry the translate button.
  for (const p of pairs) {
    if (out[p.key].trim() === '' && p.zh.trim() !== '') {
      out[p.key] = p.zh;
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Profile
// ──────────────────────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  name_zh: z.string().min(1),
  name_en: z.string().min(1),
  handle: z.string().min(1),
  role_zh: z.string(),
  role_en: z.string(),
  slogan_zh: z.string(),
  slogan_en: z.string(),
  bio_zh: z.string(),
  bio_en: z.string(),
  avatar_url: z.string().nullable().optional(),
});

export async function saveProfile(_: unknown, fd: FormData) {
  const supabase = await requireAdmin();
  const raw = {
    name_zh: readFormString(fd, 'name_zh'),
    name_en: readFormString(fd, 'name_en'),
    handle: readFormString(fd, 'handle'),
    role_zh: readFormString(fd, 'role_zh'),
    role_en: readFormString(fd, 'role_en'),
    slogan_zh: readFormString(fd, 'slogan_zh'),
    slogan_en: readFormString(fd, 'slogan_en'),
    bio_zh: readFormString(fd, 'bio_zh'),
    bio_en: readFormString(fd, 'bio_en'),
    avatar_url: readFormString(fd, 'avatar_url') || null,
  };
  const filled = await ensureEnglish([
    { key: 'name_en', zh: raw.name_zh, en: raw.name_en },
    { key: 'role_en', zh: raw.role_zh, en: raw.role_en },
    { key: 'slogan_en', zh: raw.slogan_zh, en: raw.slogan_en },
    { key: 'bio_en', zh: raw.bio_zh, en: raw.bio_en },
  ]);
  const data = ProfileSchema.parse({
    ...raw,
    name_en: filled.name_en,
    role_en: filled.role_en,
    slogan_en: filled.slogan_en,
    bio_en: filled.bio_en,
  });
  const socials = readFormJson(fd, 'socials', [] as unknown[]);

  const { error } = await supabase
    .from('profile')
    .upsert({ id: 'main', ...data, socials });
  if (error) return { ok: false as const, message: error.message };
  bust(CONTENT_TAGS.profile);
  return { ok: true as const, message: '已保存' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────────────────────────────────────

const ProjectSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(['academic', 'engineering']),
  title_zh: z.string().min(1),
  title_en: z.string().min(1),
  tagline_zh: z.string(),
  tagline_en: z.string(),
  summary_zh: z.string(),
  summary_en: z.string(),
  link: z.string().url().nullable().optional(),
  repo: z.string().url().nullable().optional(),
  cover_url: z.string().nullable().optional(),
  started_at: z.string().min(1),
  ended_at: z.string().nullable().optional(),
  display_order: z.coerce.number().int(),
  is_published: z.boolean(),
});

export async function saveProject(_: unknown, fd: FormData) {
  const id = readFormString(fd, 'id') || null;
  const raw = {
    slug: readFormString(fd, 'slug'),
    kind: readFormString(fd, 'kind') as 'academic' | 'engineering',
    title_zh: readFormString(fd, 'title_zh'),
    title_en: readFormString(fd, 'title_en'),
    tagline_zh: readFormString(fd, 'tagline_zh'),
    tagline_en: readFormString(fd, 'tagline_en'),
    summary_zh: readFormString(fd, 'summary_zh'),
    summary_en: readFormString(fd, 'summary_en'),
    link: readFormString(fd, 'link') || null,
    repo: readFormString(fd, 'repo') || null,
    cover_url: readFormString(fd, 'cover_url') || null,
    started_at: readFormString(fd, 'started_at'),
    ended_at: readFormString(fd, 'ended_at') || null,
    display_order: readFormString(fd, 'display_order', '0'),
    is_published: readFormBool(fd, 'is_published'),
  };
  const highlightsRaw = readFormJson<LocalizedRow[]>(fd, 'highlights', []);
  const filled = await ensureEnglish([
    { key: 'title_en', zh: raw.title_zh, en: raw.title_en },
    { key: 'tagline_en', zh: raw.tagline_zh, en: raw.tagline_en },
    { key: 'summary_en', zh: raw.summary_zh, en: raw.summary_en },
    ...highlightsRaw.map((row, i) => ({
      key: `highlight.${i}`,
      zh: row?.zh ?? '',
      en: row?.en ?? '',
    })),
  ]);
  const data = ProjectSchema.parse({
    ...raw,
    title_en: filled.title_en,
    tagline_en: filled.tagline_en,
    summary_en: filled.summary_en,
  });
  const tags = readFormString(fd, 'tags')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const highlights = highlightsRaw.map((row, i) => ({
    zh: row?.zh ?? '',
    en: filled[`highlight.${i}`] ?? row?.en ?? '',
  }));
  const row: DbProjectRow = {
    id: id ?? '',
    ...data,
    link: data.link ?? null,
    repo: data.repo ?? null,
    cover_url: data.cover_url ?? null,
    ended_at: data.ended_at ?? null,
    tags,
    highlights: highlights as DbProjectRow['highlights'],
  };
  const payload = projectRowToPayload(row);
  const response = await fetchBackend(
    id ? `/v1/admin/projects/${id}` : '/v1/admin/projects',
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '保存失败');
    return { ok: false as const, message: text };
  }

  bust(CONTENT_TAGS.projects, CONTENT_TAGS.timeline);
  redirect('/admin/projects');
}

export async function deleteProject(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
  bust(CONTENT_TAGS.projects, CONTENT_TAGS.timeline);
  return { ok: true as const, message: '已删除' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Experiences
// ──────────────────────────────────────────────────────────────────────────────

const ExperienceSchema = z.object({
  slug: z.string().min(1),
  org_zh: z.string().min(1),
  org_en: z.string().min(1),
  role_zh: z.string(),
  role_en: z.string(),
  summary_zh: z.string(),
  summary_en: z.string(),
  link: z.string().url().nullable().optional(),
  started_at: z.string().min(1),
  ended_at: z.string().nullable().optional(),
  display_order: z.coerce.number().int(),
  is_published: z.boolean(),
});

export async function saveExperience(_: unknown, fd: FormData) {
  const id = readFormString(fd, 'id') || null;
  const raw = {
    slug: readFormString(fd, 'slug'),
    org_zh: readFormString(fd, 'org_zh'),
    org_en: readFormString(fd, 'org_en'),
    role_zh: readFormString(fd, 'role_zh'),
    role_en: readFormString(fd, 'role_en'),
    summary_zh: readFormString(fd, 'summary_zh'),
    summary_en: readFormString(fd, 'summary_en'),
    link: readFormString(fd, 'link') || null,
    started_at: readFormString(fd, 'started_at'),
    ended_at: readFormString(fd, 'ended_at') || null,
    display_order: readFormString(fd, 'display_order', '0'),
    is_published: readFormBool(fd, 'is_published'),
  };
  const metricsRaw = readFormJson<LocalizedRow[]>(fd, 'metrics', []);
  const filled = await ensureEnglish([
    { key: 'org_en', zh: raw.org_zh, en: raw.org_en },
    { key: 'role_en', zh: raw.role_zh, en: raw.role_en },
    { key: 'summary_en', zh: raw.summary_zh, en: raw.summary_en },
    ...metricsRaw.map((row, i) => ({
      key: `metric.${i}`,
      zh: row?.zh ?? '',
      en: row?.en ?? '',
    })),
  ]);
  const data = ExperienceSchema.parse({
    ...raw,
    org_en: filled.org_en,
    role_en: filled.role_en,
    summary_en: filled.summary_en,
  });
  const metrics = metricsRaw.map((row, i) => ({
    zh: row?.zh ?? '',
    en: filled[`metric.${i}`] ?? row?.en ?? '',
  }));
  const row: DbExperienceRow = {
    id: id ?? '',
    ...data,
    link: data.link ?? null,
    ended_at: data.ended_at ?? null,
    metrics: metrics as DbExperienceRow['metrics'],
  };
  const payload = experienceRowToPayload(row);
  const response = await fetchBackend(
    id ? `/v1/admin/experiences/${id}` : '/v1/admin/experiences',
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '保存失败');
    return { ok: false as const, message: text };
  }

  bust(CONTENT_TAGS.experiences, CONTENT_TAGS.timeline);
  redirect('/admin/experiences');
}

export async function deleteExperience(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('experiences').delete().eq('id', id);
  if (error) throw new Error(error.message);
  bust(CONTENT_TAGS.experiences, CONTENT_TAGS.timeline);
  return { ok: true as const, message: '已删除' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Honors
// ──────────────────────────────────────────────────────────────────────────────

const HonorSchema = z.object({
  pillar: z.enum(['morality', 'wisdom', 'athletics', 'labor']),
  title_zh: z.string().min(1),
  title_en: z.string().min(1),
  story_zh: z.string(),
  story_en: z.string(),
  display_order: z.coerce.number().int(),
  is_published: z.boolean(),
});

export async function saveHonor(_: unknown, fd: FormData) {
  const supabase = await requireAdmin();
  const id = readFormString(fd, 'id') || null;
  const raw = {
    pillar: readFormString(fd, 'pillar') as 'morality' | 'wisdom' | 'athletics' | 'labor',
    title_zh: readFormString(fd, 'title_zh'),
    title_en: readFormString(fd, 'title_en'),
    story_zh: readFormString(fd, 'story_zh'),
    story_en: readFormString(fd, 'story_en'),
    display_order: readFormString(fd, 'display_order', '0'),
    is_published: readFormBool(fd, 'is_published'),
  };
  const filled = await ensureEnglish([
    { key: 'title_en', zh: raw.title_zh, en: raw.title_en },
    { key: 'story_en', zh: raw.story_zh, en: raw.story_en },
  ]);
  const data = HonorSchema.parse({
    ...raw,
    title_en: filled.title_en,
    story_en: filled.story_en,
  });

  const { error } = id
    ? await supabase.from('honors').update(data).eq('id', id)
    : await supabase.from('honors').insert(data);
  if (error) return { ok: false as const, message: error.message };

  bust(CONTENT_TAGS.honors);
  redirect('/admin/honors');
}

export async function deleteHonor(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('honors').delete().eq('id', id);
  if (error) throw new Error(error.message);
  bust(CONTENT_TAGS.honors);
  return { ok: true as const, message: '已删除' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Posts (long-form / blog)
// ──────────────────────────────────────────────────────────────────────────────

const PostSchema = z.object({
  slug: z.string().min(1),
  title_zh: z.string().min(1),
  title_en: z.string().min(1),
  excerpt_zh: z.string(),
  excerpt_en: z.string(),
  body_zh: z.string(),
  body_en: z.string(),
  cover_url: z.string().nullable().optional(),
  reading_minutes: z.coerce.number().int().min(1),
  display_order: z.coerce.number().int(),
  published_at: z.string().nullable().optional(),
  is_published: z.boolean(),
});

export async function savePost(_: unknown, fd: FormData) {
  const supabase = await requireAdmin();
  const id = readFormString(fd, 'id') || null;
  const data = PostSchema.parse({
    slug: readFormString(fd, 'slug'),
    title_zh: readFormString(fd, 'title_zh'),
    title_en: readFormString(fd, 'title_en'),
    excerpt_zh: readFormString(fd, 'excerpt_zh'),
    excerpt_en: readFormString(fd, 'excerpt_en'),
    body_zh: readFormString(fd, 'body_zh'),
    body_en: readFormString(fd, 'body_en'),
    cover_url: readFormString(fd, 'cover_url') || null,
    reading_minutes: readFormString(fd, 'reading_minutes', '1'),
    display_order: readFormString(fd, 'display_order', '0'),
    published_at: readFormString(fd, 'published_at') || null,
    is_published: readFormBool(fd, 'is_published'),
  });
  const tags = readFormString(fd, 'tags')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const payload = { ...data, tags };
  const { error } = id
    ? await supabase.from('posts').update(payload).eq('id', id)
    : await supabase.from('posts').insert(payload);
  if (error) return { ok: false as const, message: error.message };

  bust(CONTENT_TAGS.posts);
  redirect('/admin/posts');
}

export async function deletePost(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
  bust(CONTENT_TAGS.posts);
  return { ok: true as const, message: '已删除' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Notes (short updates / now-page)
// ──────────────────────────────────────────────────────────────────────────────

const NoteSchema = z.object({
  body_zh: z.string().min(1),
  body_en: z.string().min(1),
  mood: z.string().nullable().optional(),
  is_published: z.boolean(),
});

export async function saveNote(_: unknown, fd: FormData) {
  const supabase = await requireAdmin();
  const id = readFormString(fd, 'id') || null;
  const data = NoteSchema.parse({
    body_zh: readFormString(fd, 'body_zh'),
    body_en: readFormString(fd, 'body_en'),
    mood: readFormString(fd, 'mood') || null,
    is_published: readFormBool(fd, 'is_published'),
  });

  const { error } = id
    ? await supabase.from('notes').update(data).eq('id', id)
    : await supabase.from('notes').insert(data);
  if (error) return { ok: false as const, message: error.message };

  bust(CONTENT_TAGS.notes);
  return { ok: true as const, message: '已保存' };
}

export async function deleteNote(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw new Error(error.message);
  bust(CONTENT_TAGS.notes);
  return { ok: true as const, message: '已删除' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Site settings (singleton)
// ──────────────────────────────────────────────────────────────────────────────

const SiteSettingsSchema = z.object({
  hero_zh: z.string(),
  hero_en: z.string(),
  cta_label_zh: z.string(),
  cta_label_en: z.string(),
});

export async function saveSiteSettings(_: unknown, fd: FormData) {
  const supabase = await requireAdmin();
  const data = SiteSettingsSchema.parse({
    hero_zh: readFormString(fd, 'hero_zh'),
    hero_en: readFormString(fd, 'hero_en'),
    cta_label_zh: readFormString(fd, 'cta_label_zh'),
    cta_label_en: readFormString(fd, 'cta_label_en'),
  });
  const themeTokens = readFormJson(fd, 'theme_tokens', {} as Record<string, string>);
  const featureFlags = readFormJson(fd, 'feature_flags', {} as Record<string, boolean>);

  const { error } = await supabase
    .from('site_settings')
    .upsert({ id: 'main', ...data, theme_tokens: themeTokens, feature_flags: featureFlags });
  if (error) return { ok: false as const, message: error.message };
  bust(CONTENT_TAGS.settings);
  return { ok: true as const, message: '已保存' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Image upload (used by the form via the browser client; this action just
// returns a signed-upload URL for the chosen path.)
// ──────────────────────────────────────────────────────────────────────────────

export async function getMediaUploadUrl(path: string) {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.storage.from('media').createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  const publicUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
  return { ...data, publicUrl };
}
