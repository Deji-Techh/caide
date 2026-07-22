CREATE TABLE IF NOT EXISTS project_shares (
  id uuid PRIMARY KEY,
  public_token_hash text NOT NULL UNIQUE,
  manage_token_hash text NOT NULL,
  object_key text NOT NULL UNIQUE,
  project_name text NOT NULL,
  package_version integer NOT NULL,
  package_size bigint NOT NULL CHECK (package_size >= 0),
  checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  download_count integer NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  max_downloads integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
  completed_at timestamptz,
  CONSTRAINT project_shares_max_downloads_positive CHECK (max_downloads IS NULL OR max_downloads > 0)
);
CREATE INDEX IF NOT EXISTS project_shares_expires_at_idx ON project_shares (expires_at);
CREATE INDEX IF NOT EXISTS project_shares_status_idx ON project_shares (status);
