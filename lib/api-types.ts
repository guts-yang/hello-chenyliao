/**
 * Hand-written types matching the schema in supabase/migrations/*.sql.
 * Replace by `supabase gen types typescript` once the project is linked.
 */

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type LocalizedJson = { zh: string; en: string };

export type SocialJson =
  | { type: 'github'; href: string; label?: string }
  | { type: 'email'; href: string; label?: string }
  | { type: 'wechat'; href: string; label?: string }
  | { type: 'linkedin'; href: string; label?: string }
  | { type: 'twitter'; href: string; label?: string };

export type GalleryItem = {
  url: string;
  caption_zh?: string;
  caption_en?: string;
};

export type StackJson = {
  // Free-form: e.g. { lang: ['Python','TS'], framework: ['Next.js'], infra: ['Vercel'] }
  [category: string]: string[];
};

export type DbProfileRow = {
  id: string;
  name_zh: string;
  name_en: string;
  handle: string;
  role_zh: string;
  role_en: string;
  slogan_zh: string;
  slogan_en: string;
  bio_zh: string;
  bio_en: string;
  avatar_url: string | null;
  socials: SocialJson[];
  updated_at: string;
};

export type DbProjectRow = {
  id: string;
  slug: string;
  kind: 'academic' | 'engineering';
  title_zh: string;
  title_en: string;
  tagline_zh: string;
  tagline_en: string;
  summary_zh: string;
  summary_en: string;
  tags: string[];
  highlights: LocalizedJson[];
  link: string | null;
  repo: string | null;
  cover_url: string | null;
  gallery?: GalleryItem[];
  stack?: StackJson;
  started_at: string;
  ended_at: string | null;
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
};

export type DbExperienceRow = {
  id: string;
  slug: string;
  org_zh: string;
  org_en: string;
  role_zh: string;
  role_en: string;
  summary_zh: string;
  summary_en: string;
  metrics: LocalizedJson[];
  link: string | null;
  started_at: string;
  ended_at: string | null;
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
};

export type DbHonorRow = {
  id: string;
  pillar: 'morality' | 'wisdom' | 'athletics' | 'labor';
  title_zh: string;
  title_en: string;
  story_zh: string;
  story_en: string;
  display_order: number;
  is_published: boolean;
};

export type DbEducationRow = {
  id: string;
  school_zh: string;
  school_en: string;
  degree_zh: string;
  degree_en: string;
  notes_zh: string | null;
  notes_en: string | null;
  started_at: string;
  ended_at: string | null;
  display_order: number;
};

export type DbTimelineRow = {
  id: string;
  date: string;
  kind: 'edu' | 'work' | 'project' | 'honor';
  title_zh: string;
  title_en: string;
  body_zh: string;
  body_en: string;
  featured: boolean;
};

export type DbPostRow = {
  id: string;
  slug: string;
  title_zh: string;
  title_en: string;
  excerpt_zh: string;
  excerpt_en: string;
  body_zh: string;
  body_en: string;
  cover_url: string | null;
  tags: string[];
  reading_minutes: number;
  display_order: number;
  published_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type DbNoteRow = {
  id: string;
  body_zh: string;
  body_en: string;
  mood: string | null;
  is_published: boolean;
  created_at: string;
};

export type DbTagRow = {
  slug: string;
  name_zh: string;
  name_en: string;
  description_zh: string | null;
  description_en: string | null;
  color: string | null;
};

export type DbViewRow = {
  scope: 'project' | 'experience' | 'post' | 'home';
  ref_id: string;
  count: number;
  last_seen_at: string;
};

export type DbSiteSettingsRow = {
  id: string;
  hero_zh: string;
  hero_en: string;
  cta_label_zh: string;
  cta_label_en: string;
  theme_tokens: Record<string, string>;
  feature_flags: Record<string, boolean>;
  updated_at: string;
};

export type DbProfileEmbeddingRow = {
  id: string;
  chunk_id: string;
  source_type: 'profile' | 'project' | 'experience' | 'honor' | 'education' | 'post' | 'note';
  source_ref: string | null;
  locale: 'zh' | 'en';
  content: string;
  embedding: number[] | null;
  updated_at: string;
};

export type DbChatSessionRow = {
  id: string;
  visitor_token: string;
  locale: 'zh' | 'en';
  created_at: string;
  last_active_at: string;
};

export type DbChatMessageRow = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_name: string | null;
  tool_payload: Json | null;
  created_at: string;
};

export type AdminSession = {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
  };
};

export type AdminSessionListItem = {
  id: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  current: boolean;
  createdAt: string;
  lastActiveAt?: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type AdminContentStats = {
  projects: number;
  experiences: number;
  honors: number;
  posts?: number;
  views?: number;
};

export type MediaUploadTicket = {
  url: string;
  publicUrl?: string;
  fields?: Record<string, string>;
};
