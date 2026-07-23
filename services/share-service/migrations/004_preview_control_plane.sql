CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS preview_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  access_token_hash text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free',
  max_concurrent_sessions integer NOT NULL DEFAULT 1,
  daily_session_limit integer NOT NULL DEFAULT 8,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preview_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  base_url text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  capacity integer NOT NULL DEFAULT 2,
  active_sessions integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'online',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES preview_installations(id) ON DELETE CASCADE,
  app_id integer NOT NULL,
  worker_id uuid REFERENCES preview_workers(id) ON DELETE SET NULL,
  public_token_hash text NOT NULL UNIQUE,
  sync_token_hash text NOT NULL UNIQUE,
  worker_lease_hash text,
  state text NOT NULL DEFAULT 'queued',
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  project_bytes bigint NOT NULL DEFAULT 0,
  public_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  stopped_at timestamptz
);

CREATE INDEX IF NOT EXISTS preview_sessions_installation_idx
  ON preview_sessions(installation_id, state, created_at DESC);

CREATE INDEX IF NOT EXISTS preview_sessions_worker_idx
  ON preview_sessions(worker_id, state, updated_at);

CREATE INDEX IF NOT EXISTS preview_sessions_expiry_idx
  ON preview_sessions(expires_at)
  WHERE stopped_at IS NULL;
