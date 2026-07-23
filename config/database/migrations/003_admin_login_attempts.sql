-- Slow-path brute force defense (alongside Redis token-bucket limiter).

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip VARCHAR(64) NOT NULL,
  succeeded TINYINT(1) NOT NULL,
  attempted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY admin_login_attempts_email_attempted_idx (email, attempted_at),
  KEY admin_login_attempts_ip_attempted_idx (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
