/**
 * Content-domain types layered on top of lib/profile.ts.
 *
 * Where lib/profile.ts owns the original model (Project / Experience / Honor /
 * Education / Timeline) plus their static seed data. This module keeps the
 * reader-side "bundle" shapes the UI actually consumes.
 */
import type {
  LocalizedString,
  Project as BaseProject,
  Experience,
  Honor,
  Education,
  SocialLink,
} from '@/lib/profile';

export type { LocalizedString, Experience, Honor, Education };

export type SocialJson = SocialLink;

export type GalleryItem = {
  url: string;
  caption_zh?: string;
  caption_en?: string;
};

export type StackJson = Record<string, string[]>;

/**
 * Project augmented with the Phase-A gallery + stack columns. Backwards
 * compatible with the BaseProject defined in lib/profile.ts.
 */
export type Project = BaseProject & {
  gallery?: GalleryItem[];
  stack?: StackJson;
};

export type ProfileBundle = {
  nameZh: string;
  nameEn: string;
  handle: string;
  role: LocalizedString;
  slogan: LocalizedString;
  bio: LocalizedString;
  avatarUrl?: string;
  socials: SocialJson[];
};

export type TimelineEvent = {
  date: string;
  kind: 'edu' | 'work' | 'project' | 'honor';
  title: LocalizedString;
  body: LocalizedString;
  featured?: boolean;
};

export type SearchHit = {
  scope: 'project' | 'experience';
  slug: string;
  title: LocalizedString;
  excerpt: LocalizedString;
  href: string;
  score: number;
};

/**
 * Canonical cache-tag names. Keep this list in sync with anything that calls
 * revalidateTag(). Server actions import CONTENT_TAGS to avoid typos.
 */
export const CONTENT_TAGS = {
  profile: 'content:profile',
  projects: 'content:projects',
  experiences: 'content:experiences',
  honors: 'content:honors',
  education: 'content:education',
  timeline: 'content:timeline',
} as const;

export type ContentTagName = (typeof CONTENT_TAGS)[keyof typeof CONTENT_TAGS];
