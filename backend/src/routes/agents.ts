import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../lib/db';
import { requireTelegram, pagination } from '../lib/http';

export const AGENT_TEMPLATES = [
  { template: 'frontend-dev', role: 'dev', name: 'Frontend Dev', systemPrompt: 'You build UI in the frontend worktree. TypeScript, accessible, tested.' },
  { template: 'backend-dev', role: 'dev', name: 'Backend Dev', systemPrompt: 'You build APIs in the backend worktree. Fastify, typed, tested.' },
  { template: 'qa-automation', role: 'qa', name: 'QA Automation', systemPrompt: 'You write and run tests. You never edit production code.' },
  { template: 'security-reviewer', role: 'security', name: 'Security Reviewer', systemPrompt: 'You scan for secrets, injection, auth flaws. You never deploy.' },
  { template: 'code-reviewer', role: 'reviewer', name: 'Code Reviewer', systemPrompt: 'You review diffs for correctness, style and security. You never push or merge.' },
  { template: 'lead', role: 'lead', name: 'Lead Agent', systemPrompt: 'You plan, route and summarise. You create tasks; you never push.' },
] as const;

const CreateAgent = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  role: z.enum(['lead', 'dev', 'qa', 'reviewer', 'security', 'custom']),
  template: z.string().optional(),
  systemPrompt: z.string().max(10000).optional(),
  model: z.string().optional(),
});

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTelegram);

  app.get('/agents/templates', async () => ({ templates: AGENT_TEMPLATES }));

  app.get('/agents', async (req) => {
    const { limit, offset } = pagination(req);
    const q = req.query as { projectId?: string };
    const res = await query(
      `SELECT * FROM agents WHERE ($1::text IS NULL OR project_id=$1) ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
      [q.projectId ?? null, limit, offset],
    );
    return { agents: res.rows };
  });

  app.post('/agents', async (req, reply) => {
    const body = CreateAgent.parse(req.body);
    const template = AGENT_TEMPLATES.find((t) => t.template === body.template);
    const systemPrompt = body.systemPrompt ?? template?.systemPrompt ?? '';
    const res = await query<{ id: string }>(
      `INSERT INTO agents (project_id, name, role, template, system_prompt, model, status)
       VALUES ($1,$2,$3,$4,$5,$6,'idle') RETURNING id`,
      [body.projectId, body.name, body.role, body.template ?? null, systemPrompt, body.model ?? null],
    );
    return reply.code(201).send({ id: res.rows[0].id });
  });

  app.get('/agents/:id', async (req, reply) => {
    const res = await query(`SELECT * FROM agents WHERE id=$1`, [(req.params as { id: string }).id]);
    if (res.rows.length === 0) return reply.code(404).send({ error: 'not_found' });
    const caps = await query(`SELECT capability FROM agent_capabilities WHERE agent_id=$1`, [(req.params as { id: string }).id]);
    return { agent: res.rows[0], capabilities: caps.rows.map((r) => r.capability) };
  });

  app.patch('/agents/:id/capabilities', async (req) => {
    const id = (req.params as { id: string }).id;
    const body = z.object({ capabilities: z.array(z.string()).min(0) }).parse(req.body);
    await query(`DELETE FROM agent_capabilities WHERE agent_id=$1`, [id]);
    for (const cap of body.capabilities) {
      await query(`INSERT INTO agent_capabilities (agent_id, capability) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, cap]);
    }
    return { ok: true };
  });
}
