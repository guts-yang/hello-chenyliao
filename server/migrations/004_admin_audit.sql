-- Append-only audit log for admin actions.

CREATE TABLE IF NOT EXISTS admin_audit (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  action VARCHAR(128) NOT NULL,
  target TEXT NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  meta JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY admin_audit_created_at_idx (created_at),
  KEY admin_audit_action_created_at_idx (action, created_at),
  CONSTRAINT admin_audit_user_fk
    FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
