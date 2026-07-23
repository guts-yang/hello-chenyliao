-- Email is normalized to lowercase on write; unique on email already enforces
-- case-insensitive uniqueness for the application. This generated column +
-- index mirrors the Postgres lower(email) expression index.

ALTER TABLE admin_users
  ADD COLUMN email_lower VARCHAR(255)
    GENERATED ALWAYS AS (LOWER(email)) STORED;

CREATE UNIQUE INDEX admin_users_email_lower_idx ON admin_users (email_lower);
