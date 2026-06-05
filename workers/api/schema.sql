-- Chat groups
CREATE TABLE IF NOT EXISTS chat_groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Group membership
CREATE TABLE IF NOT EXISTS chat_group_members (
  group_id  TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cgm_user ON chat_group_members(user_id);
