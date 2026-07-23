-- Per-session bookkeeping for the admin settings page.

ALTER TABLE admin_sessions
  ADD COLUMN ip VARCHAR(64) NULL,
  ADD COLUMN user_agent VARCHAR(512) NULL,
  ADD COLUMN last_seen_at DATETIME(3) NULL;

CREATE INDEX admin_sessions_user_id_last_seen_idx
  ON admin_sessions (user_id, last_seen_at);
