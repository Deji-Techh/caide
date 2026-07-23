CREATE TABLE IF NOT EXISTS preview_devices (
  id uuid PRIMARY KEY,
  installation_hash text NOT NULL UNIQUE,
  access_token_hash text NOT NULL UNIQUE,
  label text NOT NULL,
  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'team', 'internal')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted')),
  concurrent_limit integer NOT NULL DEFAULT 1 CHECK (concurrent_limit > 0),
  daily_session_limit integer NOT NULL DEFAULT 10 CHECK (daily_session_limit > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preview_workers (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  base_url text NOT NULL,
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  active_sessions integer NOT NULL DEFAULT 0 CHECK (active_sessions >= 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'draining', 'offline')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS preview_workers_name_idx
  ON preview_workers(name);

CREATE TABLE IF NOT EXISTS preview_sessions (
  id uuid PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES preview_devices(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES preview_workers(id) ON DELETE SET NULL,
  project_name text NOT NULL,
  object_key text NOT NULL,
  bundle_size bigint NOT NULL CHECK (bundle_size > 0),
  checksum text NOT NULL,
  public_token_hash text NOT NULL UNIQUE,
  public_url text,
  status text NOT NULL DEFAULT 'pending_upload'
    CHECK (
      status IN (
        'pending_upload',
        'queued',
        'starting',
        'live',
        'syncing',
        'failed',
        'stopped',
        'expired'
      )
    ),
  error_message text,
  worker_slot_released boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  stopped_at timestamptz
);

CREATE INDEX IF NOT EXISTS preview_sessions_device_status_idx
  ON preview_sessions(device_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS preview_sessions_worker_status_idx
  ON preview_sessions(worker_id, status);
CREATE INDEX IF NOT EXISTS preview_sessions_expiry_idx
  ON preview_sessions(expires_at, status);

CREATE TABLE IF NOT EXISTS preview_revisions (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES preview_sessions(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  bundle_size bigint NOT NULL CHECK (bundle_size > 0),
  checksum text NOT NULL,
  status text NOT NULL DEFAULT 'pending_upload'
    CHECK (status IN ('pending_upload', 'applying', 'active', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS preview_revisions_session_created_idx
  ON preview_revisions(session_id, created_at DESC);
