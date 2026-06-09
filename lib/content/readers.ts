import 'server-only';
import {
  profile as staticProfile,
  projects as staticProjects,
  experiences as staticExperiences,
  honors as staticHonors,
  education as staticEducation,
  timeline as staticTimeline,
} from '@/lib/profile';
import { CONTENT_TAGS, withTags } from './cache';
import type {
  Education,
  Experience,
  Honor,
  ProfileBundle,
  Project,
  TimelineEvent,
  SocialJson,
} from './types';

/**
 * Content readers backed by the curated static profile data. Keeping this
 * facade lets pages import from `@/lib/content` without pulling in CMS code.
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
  return staticProfileBundle;
}

async function readProjects(): Promise<Project[]> {
  return staticProjects;
}

async function readExperiences(): Promise<Experience[]> {
  return staticExperiences;
}

async function readHonors(): Promise<Honor[]> {
  return staticHonors;
}

async function readEducation(): Promise<Education[]> {
  return staticEducation;
}

async function readTimeline(): Promise<TimelineEvent[]> {
  return staticTimeline;
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

export { CONTENT_REVALIDATE_SECONDS as contentRevalidate } from './cache';
