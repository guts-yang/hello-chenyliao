export type Locale = 'zh' | 'en';
export type Localized = Record<Locale, string>;

export interface Profile {
  id?: string;
  nameZh: string;
  nameEn: string;
  handle: string;
  role: Localized;
  slogan: Localized;
  bio: Localized;
  avatarUrl?: string;
  socials?: Array<{ type: string; href: string; label?: string }>;
  updatedAt?: string;
}

export interface Project {
  id?: string;
  slug: string;
  kind?: string;
  title: Localized;
  tagline: Localized;
  summary: Localized;
  tags: string[];
  highlights: Localized[];
  startedAt: string;
  endedAt?: string;
  link?: string;
  repo?: string;
  coverUrl?: string;
  displayOrder?: number;
  isPublished?: boolean;
}

export interface Experience {
  id?: string;
  slug: string;
  org: Localized;
  role: Localized;
  summary: Localized;
  metrics: Localized[];
  startedAt: string;
  endedAt?: string;
  link?: string;
  displayOrder?: number;
  isPublished?: boolean;
}

export interface Honor {
  id?: string;
  pillar: string;
  title: Localized;
  story: Localized;
  displayOrder?: number;
  isPublished?: boolean;
}

export interface Education {
  id?: string;
  school: Localized;
  degree: Localized;
  notes?: Localized;
  startedAt: string;
  endedAt?: string;
  displayOrder?: number;
}

export interface TimelineEvent {
  id?: string;
  date: string;
  kind: string;
  title: Localized;
  body: Localized;
}

export interface HomeContent {
  profile: Profile;
  projects: Project[];
  experiences: Experience[];
  honors: Honor[];
  education: Education[];
  timeline: TimelineEvent[];
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  tools?: Array<{ name: string; data: unknown }>;
}

export interface ChatSession {
  id: string;
  title: string;
  locale: Locale;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  email: string;
  role: string;
}

export interface AdminSessionItem {
  id: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export interface AdminAuditItem {
  id: string;
  action: string;
  target?: string;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminStats {
  projects: number;
  experiences: number;
  honors: number;
  education?: number;
  timeline?: number;
  resume?: number;
}

export interface ResumeSettings {
  url: string;
  available: boolean;
  updatedAt?: string;
}
