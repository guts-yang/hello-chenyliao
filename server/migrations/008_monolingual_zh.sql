-- Convert the legacy bilingual CMS schema to the Chinese-only schema.
-- Migrations are recorded in schema_migrations, so this one is applied once.
-- Keep the Chinese value when collapsing each pair of localized columns.

ALTER TABLE profile
  CHANGE COLUMN name_zh name TEXT NOT NULL,
  CHANGE COLUMN role_zh role TEXT NOT NULL,
  CHANGE COLUMN slogan_zh slogan TEXT NOT NULL,
  CHANGE COLUMN bio_zh bio TEXT NOT NULL,
  DROP COLUMN name_en,
  DROP COLUMN role_en,
  DROP COLUMN slogan_en,
  DROP COLUMN bio_en;

ALTER TABLE projects
  CHANGE COLUMN title_zh title TEXT NOT NULL,
  CHANGE COLUMN tagline_zh tagline TEXT NOT NULL,
  CHANGE COLUMN summary_zh summary TEXT NOT NULL,
  DROP COLUMN title_en,
  DROP COLUMN tagline_en,
  DROP COLUMN summary_en;

ALTER TABLE experiences
  CHANGE COLUMN org_zh org TEXT NOT NULL,
  CHANGE COLUMN role_zh role TEXT NOT NULL,
  CHANGE COLUMN summary_zh summary TEXT NOT NULL,
  DROP COLUMN org_en,
  DROP COLUMN role_en,
  DROP COLUMN summary_en;

ALTER TABLE honors
  CHANGE COLUMN title_zh title TEXT NOT NULL,
  CHANGE COLUMN story_zh story TEXT NOT NULL,
  DROP COLUMN title_en,
  DROP COLUMN story_en;

ALTER TABLE education
  CHANGE COLUMN school_zh school TEXT NOT NULL,
  CHANGE COLUMN degree_zh degree TEXT NOT NULL,
  CHANGE COLUMN notes_zh notes TEXT NULL,
  DROP COLUMN school_en,
  DROP COLUMN degree_en,
  DROP COLUMN notes_en;

ALTER TABLE timeline
  CHANGE COLUMN title_zh title TEXT NOT NULL,
  CHANGE COLUMN body_zh body TEXT NOT NULL,
  DROP COLUMN title_en,
  DROP COLUMN body_en;

-- Legacy highlights/metrics are [{"zh":"…","en":"…"}]. Retain zh, falling
-- back to en only when the Chinese value is absent, and leave string arrays
-- unchanged. JSON_TABLE requires MySQL 8, which is already this project's DB.
UPDATE projects AS p
SET highlights = (
  SELECT JSON_ARRAYAGG(COALESCE(item.zh, item.en, ''))
  FROM JSON_TABLE(
    p.highlights,
    '$[*]' COLUMNS (
      zh TEXT PATH '$.zh' NULL ON EMPTY,
      en TEXT PATH '$.en' NULL ON EMPTY
    )
  ) AS item
)
WHERE JSON_TYPE(JSON_EXTRACT(p.highlights, '$[0]')) = 'OBJECT';

UPDATE experiences AS e
SET metrics = (
  SELECT JSON_ARRAYAGG(COALESCE(item.zh, item.en, ''))
  FROM JSON_TABLE(
    e.metrics,
    '$[*]' COLUMNS (
      zh TEXT PATH '$.zh' NULL ON EMPTY,
      en TEXT PATH '$.en' NULL ON EMPTY
    )
  ) AS item
)
WHERE JSON_TYPE(JSON_EXTRACT(e.metrics, '$[0]')) = 'OBJECT';

-- 007_site_settings runs first. This protects manual application where it did
-- not run and is otherwise a no-op.
CREATE TABLE IF NOT EXISTS site_settings (
  `key` VARCHAR(64) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
