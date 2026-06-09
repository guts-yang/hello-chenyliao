import 'server-only';
import { createSupabaseAnonClient } from '@/lib/supabase/server';
import {
  profile as staticProfile,
  projects as staticProjects,
  experiences as staticExperiences,
  honors as staticHonors,
  education as staticEducation,
  timeline as staticTimeline,
} from '@/lib/profile';
import type {
  DbExperienceRow,
  DbHonorRow,
  DbEducationRow,
  DbNoteRow,
  DbPostRow,
  DbProfileRow,
  DbProjectRow,
  DbSiteSettingsRow,
  DbTimelineRow,
  SocialJson,
} from '@/lib/supabase/types';
import {
  fromEducationRow,
  fromExperienceRow,
  fromHonorRow,
  fromNoteRow,
  fromPostRow,
  fromProfileRow,
  fromProjectRow,
  fromSiteSettingsRow,
  fromTimelineRow,
} from './adapters';
import { CONTENT_TAGS, withTags } from './cache';
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

/**
 * Content readers: try Supabase first, fall back to the static seed in
 * lib/profile.ts when the project isn't wired up yet. Each reader is wrapped
 * by withTags() so admin writes can punch through with revalidateTag().
 */

const staticProfileBundle: ProfileBundle = {
  nameZh: staticProfile.nameZh,
  nameEn: staticProfile.nameEn,
  handle: staticProfile.handle,
  role: staticProfile.role,
  slogan: staticProfile.slogan,
  bio: staticProfile.bio,
  avatarUrl: staticProfile.avatarUrl,
  socials: staticProfile.socials as unknown as SocialJson[],
};

async function readProfile(): Promise<ProfileBundle> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticProfileBundle;
  const { data, error } = await sb.from('profile').select('*').eq('id', 'main').maybeSingle();
  if (error || !data) return staticProfileBundle;
  return fromProfileRow(data as unknown as DbProfileRow);
}

async function readProjects(): Promise<Project[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticProjects;
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: false })
    .order('started_at', { ascending: false });
  if (error || !data || data.length === 0) return staticProjects;
  return (data as DbProjectRow[]).map(fromProjectRow);
}

async function readExperiences(): Promise<Experience[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticExperiences;
  const { data, error } = await sb
    .from('experiences')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: false })
    .order('started_at', { ascending: false });
  if (error || !data || data.length === 0) return staticExperiences;
  return (data as DbExperienceRow[]).map(fromExperienceRow);
}

async function readHonors(): Promise<Honor[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticHonors;
  const { data, error } = await sb
    .from('honors')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: false });
  if (error || !data || data.length === 0) return staticHonors;
  return (data as DbHonorRow[]).map(fromHonorRow);
}

async function readEducation(): Promise<Education[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticEducation;
  const { data, error } = await sb
    .from('education')
    .select('*')
    .order('display_order', { ascending: false });
  if (error || !data || data.length === 0) return staticEducation;
  return (data as DbEducationRow[]).map(fromEducationRow);
}

async function readTimeline(): Promise<TimelineEvent[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticTimeline;
  const { data, error } = await sb.from('timeline').select('*').order('date', { ascending: true });
  if (error || !data || data.length === 0) return staticTimeline;
  return (data as DbTimelineRow[]).map(fromTimelineRow);
}

async function readPosts(): Promise<Post[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from('posts')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return (data as DbPostRow[]).map(fromPostRow);
}

async function readNotes(): Promise<Note[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from('notes')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as DbNoteRow[]).map(fromNoteRow);
}

async function readSiteSettings(): Promise<SiteSettings | null> {
  const sb = createSupabaseAnonClient();
  if (!sb) return null;
  const { data, error } = await sb.from('site_settings').select('*').eq('id', 'main').maybeSingle();
  if (error || !data) return null;
  return fromSiteSettingsRow(data as unknown as DbSiteSettingsRow);
}

// ──────────────────────────────────────────────────────────────────────────────
// Public, cache-wrapped readers
// ──────────────────────────────────────────────────────────────────────────────

export const getProfile = withTags('content:profile:main', [CONTENT_TAGS.profile], readProfile);
export const getProjects = withTags('content:projects:list', [CONTENT_TAGS.projects], readProjects);
export const getExperiences = withTags(
  'content:experiences:list',
  [CONTENT_TAGS.experiences],
  readExperiences,
);
export const getHonors = withTags('content:honors:list', [CONTENT_TAGS.honors], readHonors);
export const getEducation = withTags(
  'content:education:list',
  [CONTENT_TAGS.education],
  readEducation,
);
export const getTimeline = withTags(
  'content:timeline:list',
  [CONTENT_TAGS.timeline],
  readTimeline,
);
export const getPosts = withTags('content:posts:list', [CONTENT_TAGS.posts], readPosts);
export const getNotes = withTags('content:notes:list', [CONTENT_TAGS.notes], readNotes);
export const getSiteSettings = withTags(
  'content:site-settings:main',
  [CONTENT_TAGS.settings],
  readSiteSettings,
);

// ──────────────────────────────────────────────────────────────────────────────
// Convenience: by-slug lookups
// ──────────────────────────────────────────────────────────────────────────────

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  const all = await getProjects();
  return all.find((p) => p.slug === slug);
}

export async function getExperienceBySlug(slug: string): Promise<Experience | undefined> {
  const all = await getExperiences();
  return all.find((e) => e.slug === slug);
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  const all = await getPosts();
  return all.find((p) => p.slug === slug);
}

export async function getLatestNote(): Promise<Note | undefined> {
  const all = await getNotes();
  return all[0];
}

export { CONTENT_REVALIDATE_SECONDS as contentRevalidate } from './cache';
