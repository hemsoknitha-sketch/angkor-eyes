-- 002 — rooms, messages (message tree for branching/regenerate), worktrees
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  telegram_chat_id TEXT UNIQUE NOT NULL,
  title TEXT,
  kind TEXT NOT NULL DEFAULT 'group' CHECK (kind IN ('group','dm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rooms_project ON rooms (project_id);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user','agent','system')),
  content TEXT NOT NULL,
  telegram_update_id BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages (room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages (parent_id);
CREATE INDEX IF NOT EXISTS idx_messages_fts ON messages USING gin (to_tsvector('english', content));

CREATE TABLE IF NOT EXISTS worktrees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  branch_name TEXT NOT NULL,
  base_commit_sha TEXT NOT NULL,
  head_commit_sha TEXT,
  path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','merged','abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_worktrees_project_branch ON worktrees (project_id, branch_name);
