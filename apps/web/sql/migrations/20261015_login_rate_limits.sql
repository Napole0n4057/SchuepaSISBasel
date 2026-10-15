-- Persist credentials sign-in failure buckets in Neon.
-- No account rows, sessions, or blog content are changed.
CREATE TABLE IF NOT EXISTS login_rate_limit_buckets (
  bucket_hash text PRIMARY KEY CHECK (bucket_hash ~ '^[a-f0-9]{64}$'),
  failures integer NOT NULL CHECK (failures > 0),
  max_failures integer NOT NULL CHECK (max_failures > 0),
  window_started_at timestamptz NOT NULL,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_rate_limit_buckets_updated_at
  ON login_rate_limit_buckets(updated_at);
