CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id uuid PRIMARY KEY,
  project_name text NOT NULL,
  owner_participant_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','expired')),
  next_sequence bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS collaboration_participants (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','editor','viewer')),
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'collaboration_sessions_owner_fk'
  ) THEN
    ALTER TABLE collaboration_sessions
      ADD CONSTRAINT collaboration_sessions_owner_fk
      FOREIGN KEY (owner_participant_id)
      REFERENCES collaboration_participants(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS collaboration_invites (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('editor','viewer')),
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL DEFAULT 20 CHECK (max_uses > 0 AND max_uses <= 1000),
  use_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES collaboration_participants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS collaboration_files (
  session_id uuid NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  path text NOT NULL,
  content text NOT NULL,
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, path)
);

CREATE TABLE IF NOT EXISTS collaboration_events (
  session_id uuid NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  sequence bigint NOT NULL,
  type text NOT NULL,
  actor_id uuid REFERENCES collaboration_participants(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, sequence)
);

CREATE INDEX IF NOT EXISTS collaboration_events_session_sequence_idx
  ON collaboration_events(session_id, sequence);
CREATE INDEX IF NOT EXISTS collaboration_participants_session_idx
  ON collaboration_participants(session_id);

CREATE TABLE IF NOT EXISTS collaboration_checkpoints (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES collaboration_participants(id),
  name text NOT NULL,
  files jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
