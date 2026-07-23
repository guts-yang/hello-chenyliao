-- Site settings for managed assets such as resume PDF.
CREATE TABLE IF NOT EXISTS site_settings (
  `key` VARCHAR(64) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
