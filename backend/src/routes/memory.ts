import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../lib/db';
import { requireTelegram, pagination } from '../lib/http';
import { extractRuleCandidate, retrieveMemories, approveMemory, buildMemoryPromptBlock } from '../services/memory-engine';

const CreateMemory = z.object({
  scope: z.enum(['global', 'project', 'agent']),
  scopeId: z.string().nullable().optional(),
  kind: z.enum(['rule', 'preference', 'correction', 'fact']),
  content: z.string().min(1).max(5000),
  confidence: z.number().min(0).max(1).default(0.8),
  provenance: z.string().default('user'),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTelegram);

  app.get('/memories', async (req) => {
    const { limit, offset } = pagination(req);
    const q = req.query as { scope?: string; scopeId?: string; q?: string };
    if (q.q) {
      const memories = await retrieveMemories({ queryText: q.q, scope: q.scope as never, scopeId: q.scopeId ?? null, limit });
      return { memories };
    }
    const res = await query(
      `SELECT * FROM shared_memories WHERE ($1::text IS NULL OR scope=$1) AND ($2::text IS NULL OR scope_id=$2)
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [q.scope ?? null, q.scopeId ?? null, limit, offset],
    );
    return { memories: res.rows };
  });

  app.post('/memories', async (req, reply) => {
    const body = CreateMemory.parse(req.body);
    // Important Global rules start as pending — they need user approval.
    const status = body.scope === 'global' ? 'pending' : 'active';
    const res = await query<{ id: string }>(
      `INSERT INTO shared_memories (scope, scope_id, kind, content, confidence, provenance, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [body.scope, body.scopeId ?? null, body.kind, body.content, body.confidence, body.provenance, status, body.expiresAt ?? null],
    );
    return reply.code(201).send({ id: res.rows[0].id, status });
  });

  /** Correction detector entry point: feed user text, get a candidate rule (or null). */
  app.post('/memories/extract', async (req) => {
    const body = z.object({ text: z.string().min(1), scope: z.enum(['global', 'project', 'agent']).default('project'), scopeId: z.string().nullable().optional() }).parse(req.body);
    const candidate = await extractRuleCandidate(body.text, body.scope, body.scopeId ?? null, `user:${req.telegramUser!.id}`);
    return { candidate };
  });

  app.post('/memories/:id/approve', async (req, reply) => {
    try {
      await approveMemory((req.params as { id: string }).id, req.telegramUser!.id);
      return { ok: true };
    } catch (err) {
      return reply.code(400).send({ error: String(err) });
    }
  });

  app.get('/memories/:id/versions', async (req) => {
    const res = await query(`SELECT * FROM memory_versions WHERE memory_id=$1 ORDER BY version ASC`, [(req.params as { id: string }).id]);
    return { versions: res.rows };
  });

  /** System-prompt block for an agent (memories injected as data). */
  app.get('/memories/prompt-block', async (req) => {
    const q = req.query as { q?: string; scope?: string; scopeId?: string };
    const memories = await retrieveMemories({ queryText: q.q ?? '', scope: q.scope as never, scopeId: q.scopeId ?? null, limit: 10 });
    return { promptBlock: buildMemoryPromptBlock(memories) };
  });
}
