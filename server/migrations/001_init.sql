-- MySQL 8 mapping of the original Postgres 001_init schema.
-- uuid -> CHAR(36); timestamptz -> DATETIME(3) UTC; jsonb -> JSON; text[] -> JSON.

CREATE TABLE IF NOT EXISTS admin_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'admin',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY admin_users_email_uq (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY admin_sessions_token_uq (token),
  CONSTRAINT admin_sessions_user_fk
    FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profile (
  id VARCHAR(64) NOT NULL PRIMARY KEY DEFAULT 'main',
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  handle VARCHAR(128) NOT NULL,
  role_zh TEXT NOT NULL,
  role_en TEXT NOT NULL,
  slogan_zh TEXT NOT NULL,
  slogan_en TEXT NOT NULL,
  bio_zh TEXT NOT NULL,
  bio_en TEXT NOT NULL,
  avatar_url TEXT NULL,
  socials JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  tagline_zh TEXT NOT NULL,
  tagline_en TEXT NOT NULL,
  summary_zh TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  tags JSON NOT NULL,
  highlights JSON NOT NULL,
  link TEXT NULL,
  repo TEXT NULL,
  cover_url TEXT NULL,
  started_at DATE NOT NULL,
  ended_at DATE NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY projects_slug_uq (slug),
  CONSTRAINT projects_kind_chk CHECK (kind IN ('academic', 'engineering')),
  KEY projects_published_order_idx (is_published, display_order, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS experiences (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL,
  org_zh TEXT NOT NULL,
  org_en TEXT NOT NULL,
  role_zh TEXT NOT NULL,
  role_en TEXT NOT NULL,
  summary_zh TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  metrics JSON NOT NULL,
  link TEXT NULL,
  started_at DATE NOT NULL,
  ended_at DATE NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY experiences_slug_uq (slug),
  KEY experiences_published_order_idx (is_published, display_order, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS honors (
  id CHAR(36) NOT NULL PRIMARY KEY,
  pillar VARCHAR(32) NOT NULL,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  story_zh TEXT NOT NULL,
  story_en TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT honors_pillar_chk CHECK (pillar IN ('morality', 'wisdom', 'athletics', 'labor')),
  KEY honors_published_order_idx (is_published, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS education (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_zh TEXT NOT NULL,
  school_en TEXT NOT NULL,
  degree_zh TEXT NOT NULL,
  degree_en TEXT NOT NULL,
  notes_zh TEXT NULL,
  notes_en TEXT NULL,
  started_at DATE NOT NULL,
  ended_at DATE NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY education_order_idx (display_order, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS timeline (
  id CHAR(36) NOT NULL PRIMARY KEY,
  date DATE NOT NULL,
  kind VARCHAR(32) NOT NULL,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_zh TEXT NOT NULL,
  body_en TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT timeline_kind_chk CHECK (kind IN ('edu', 'work', 'project', 'honor')),
  KEY timeline_date_idx (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
