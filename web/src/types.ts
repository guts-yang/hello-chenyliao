export interface Profile {
  id?: string;
  name: string;
  handle: string;
  role: string;
  slogan: string;
  bio: string;
  avatarUrl?: string;
  socials?: Array<{ type: string; href: string; label?: string }>;
  updatedAt?: string;
}

export interface Project {
  id?: string;
  slug: string;
  kind?: string;
  title: string;
  tagline: string;
  summary: string;
  tags: string[];
  highlights: string[];
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
  org: string;
  role: string;
  summary: string;
  metrics: string[];
  startedAt: string;
  endedAt?: string;
  link?: string;
  displayOrder?: number;
  isPublished?: boolean;
}

export interface Honor {
  id?: string;
  pillar: string;
  title: string;
  story: string;
  displayOrder?: number;
  isPublished?: boolean;
}

export interface Education {
  id?: string;
  school: string;
  degree: string;
  notes?: string;
  startedAt: string;
  endedAt?: string;
  displayOrder?: number;
}

export interface TimelineEvent {
  id?: string;
  date: string;
  kind: string;
  title: string;
  body: string;
}

export interface VisualSettings {
  heroVideoUrl: string;
  featureVideoUrl: string;
  featureIconProjects: string;
  featureIconExperience: string;
  featureIconEducation: string;
  updatedAt?: string;
}

export interface HomeContent {
  profile: Profile;
  projects: Project[];
  experiences: Experience[];
  honors: Honor[];
  education: Education[];
  timeline: TimelineEvent[];
  visuals: VisualSettings;
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
  locale?: string;
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
