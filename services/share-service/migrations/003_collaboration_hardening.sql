ALTER TABLE collaboration_participants
  ADD COLUMN IF NOT EXISTS left_at timestamptz;

CREATE INDEX IF NOT EXISTS collaboration_participants_presence_idx
  ON collaboration_participants(session_id, left_at, last_seen_at);

UPDATE collaboration_participants
   SET left_at = NULL WHERE left_at IS NOT NULL AND role = 'owner';
