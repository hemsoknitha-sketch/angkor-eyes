-- 004 — approval_requests (TOCTOU-proof), shared_memories (pgvector), memory_versions
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  target_repo TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  target_commit_sha TEXT NOT NULL,
  requested_action TEXT NOT NULL,
  requested_by_agent UUID REFERENCES agents(id) ON DELETE SET NULL,
  action_hash TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','executed')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approvals_project_status ON approval_requests (project_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approval_requests (status, expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS shared_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global','project','agent')),
  scope_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('rule','preference','correction','fact')),
  content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  version INT NOT NULL DEFAULT 1,
  provenance TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','conflict','expired')),
  embedding vector(1536),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memories_scope ON shared_memories (scope, scope_id, status);
CREATE INDEX IF NOT EXISTS idx_memories_fts ON shared_memories USING gin (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON shared_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS memory_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES shared_memories(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content TEXT NOT NULL,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memory_versions ON memory_versions (memory_id, version);
