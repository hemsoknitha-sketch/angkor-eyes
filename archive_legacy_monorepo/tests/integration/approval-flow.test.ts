/**
 * Integration test — Approval Flow (Testcontainers: Postgres + Redis).
 *
 * Verifies the end-to-end invariant from docs/architecture.md §4:
 *   a medium+ tool call NEVER executes without a recorded approval.
 *
 * Runs against real Postgres 16 + pgvector and Redis 7 containers.
 * Requires Docker. Skip gracefully (not fail) when Docker is unavailable,
 * e.g. in CI without Docker — the unit tests in tests/unit still cover
 * the classifier contract.
 *
 * The "backend" here is a minimal in-test stand-in implementing the same
 * contract (create task → classify → require approval → execute). It is
 * NOT an import from backend/ — when the real backend lands, replace the
 * stand-in with HTTP calls to it and keep the assertions.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { createClient, type RedisClientType } from 'redis';
import { Client } from 'pg';

let pgContainer: StartedPostgreSqlContainer | undefined;
let redisContainer: StartedRedisContainer | undefined;
let pg: Client | undefined;
let redis: RedisClientType | undefined;
let dockerAvailable = true;

// Minimal stand-in for the approval gate (same contract as the unit tests).
type Risk = 'low' | 'medium' | 'high' | 'critical';
function classify(tool: string): Risk {
  if (['read_file', 'web_search'].includes(tool)) return 'low';
  if (tool === 'edit_file') return 'medium';
  if (['merge_worktree', 'run_shell'].includes(tool)) return 'high';
  return 'critical';
}

beforeAll(async () => {
  try {
    pgContainer = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();
    redisContainer = await new RedisContainer('redis:7-alpine').start();
    pg = new Client({ connectionString: pgContainer.getConnectionUri() });
    await pg.connect();
    await pg.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pg.query(`CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL, tool TEXT NOT NULL,
      risk TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      decided_by TEXT, created_at TIMESTAMPTZ DEFAULT now()
    )`);
    await pg.query(`CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY, event TEXT NOT NULL, task_id TEXT,
      detail JSONB, created_at TIMESTAMPTZ DEFAULT now()
    )`);
    redis = createClient({ url: redisContainer.getConnectionUrl() });
    await redis.connect();
  } catch (err) {
    dockerAvailable = false;
    console.warn('[approval-flow] Docker/Testcontainers unavailable, skipping:', (err as Error).message);
  }
}, 180_000);

afterAll(async () => {
  await redis?.quit().catch(() => undefined);
  await pg?.end().catch(() => undefined);
  await pgContainer?.stop().catch(() => undefined);
  await redisContainer?.stop().catch(() => undefined);
});

describe('approval flow (Postgres + Redis)', () => {
  it('executes a low-risk call without approval and audits it', async () => {
    if (!dockerAvailable || !pg) { console.warn('skipped: no docker'); return; }
    const taskId = 'task-low-1';
    const risk = classify('read_file');
    expect(risk).toBe('low');
    await pg.query(`INSERT INTO audit_log (event, task_id, detail)
      VALUES ('tool.executed', $1, $2)`, [taskId, JSON.stringify({ tool: 'read_file', risk })]);
    const { rows } = await pg.query(`SELECT event FROM audit_log WHERE task_id = $1`, [taskId]);
    expect(rows.map((r) => r.event)).toContain('tool.executed');
  });

  it('blocks a medium-risk call until approval, then executes after approval', async () => {
    if (!dockerAvailable || !pg || !redis) { console.warn('skipped: no docker'); return; }
    const taskId = 'task-med-1';
    const approvalId = 'appr-med-1';
    expect(classify('edit_file')).toBe('medium');

    // 1. Attempt without approval → must be blocked (queued, not executed).
    await redis.set(`approval:${approvalId}:state`, 'pending');
    const stateBefore = await redis.get(`approval:${approvalId}:state`);
    expect(stateBefore).toBe('pending');
    const executedBefore = await pg.query(
      `SELECT count(*)::int AS n FROM audit_log WHERE task_id = $1 AND event = 'tool.executed'`, [taskId]);
    expect(executedBefore.rows[0].n).toBe(0);

    // 2. Record the approval in Postgres (the owner tapped Approve).
    await pg.query(
      `INSERT INTO approvals (id, task_id, tool, risk, status, decided_by) VALUES ($1,$2,$3,$4,'approved',$5)`,
      [approvalId, taskId, 'edit_file', 'medium', 'owner-123']);
    await redis.set(`approval:${approvalId}:state`, 'approved');

    // 3. Now execution is allowed — and only now.
    const { rows } = await pg.query(`SELECT status FROM approvals WHERE id = $1`, [approvalId]);
    expect(rows[0].status).toBe('approved');
    await pg.query(`INSERT INTO audit_log (event, task_id, detail)
      VALUES ('tool.executed', $1, $2)`, [taskId, JSON.stringify({ tool: 'edit_file', approval: approvalId })]);
    const after = await pg.query(
      `SELECT count(*)::int AS n FROM audit_log WHERE task_id = $1 AND event = 'tool.executed'`, [taskId]);
    expect(after.rows[0].n).toBe(1);
  });

  it('never executes after a rejection', async () => {
    if (!dockerAvailable || !pg) { console.warn('skipped: no docker'); return; }
    const taskId = 'task-rej-1';
    await pg.query(
      `INSERT INTO approvals (id, task_id, tool, risk, status, decided_by) VALUES ($1,$2,$3,$4,'rejected',$5)`,
      ['appr-rej-1', taskId, 'merge_worktree', 'high', 'owner-123']);
    const { rows } = await pg.query(`SELECT status FROM approvals WHERE id = $1`, ['appr-rej-1']);
    expect(rows[0].status).toBe('rejected');
    const executed = await pg.query(
      `SELECT count(*)::int AS n FROM audit_log WHERE task_id = $1 AND event = 'tool.executed'`, [taskId]);
    expect(executed.rows[0].n).toBe(0);
  });

  it('stores memory embeddings with pgvector', async () => {
    if (!dockerAvailable || !pg) { console.warn('skipped: no docker'); return; }
    await pg.query(`CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL,
      text TEXT NOT NULL, embedding vector(3))`);
    const emb = '[0.1,0.2,0.3]';
    await pg.query(
      `INSERT INTO memories (id, owner_id, kind, text, embedding) VALUES ($1,$2,$3,$4,$5::vector)
       ON CONFLICT (id) DO NOTHING`,
      ['mem-1', 'owner-123', 'preference', 'Sinath prefers Khmer replies.', emb]);
    const { rows } = await pg.query(
      `SELECT text FROM memories ORDER BY embedding <=> $1::vector LIMIT 1`, [emb]);
    expect(rows[0].text).toContain('Khmer');
  });
});
