import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../lib/db';
import { requireTelegram } from '../lib/http';
import { dailyUsage, checkBudget } from '../services/usage-tracker';
import { feedbackAggregate } from '../services/evaluation';

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTelegram);

  app.get('/usage', async (req) => {
    const q = req.query as { projectId?: string };
    if (!q.projectId) return { error: 'projectId required' };
    const usage = await dailyUsage(q.projectId);
    const budget = await checkBudget(q.projectId);
    return { ...usage, budget };
  });

  app.get('/usage/summary', async (req) => {
    const q = req.query as { projectId?: string };
    const res = await query(
      `SELECT model, provider, SUM(input_tokens+output_tokens) AS tokens, SUM(cost_usd) AS cost
       FROM usage_logs WHERE ($1::text IS NULL OR project_id=$1)
       GROUP BY model, provider ORDER BY cost DESC LIMIT 50`,
      [q.projectId ?? null],
    );
    return { byModel: res.rows };
  });

  /** Feedback 👍/👎 on a message or task output. */
  app.post('/feedback', async (req, reply) => {
    const body = z.object({
      projectId: z.string().uuid().optional(),
      messageId: z.string().uuid().optional(),
      taskId: z.string().uuid().optional(),
      rating: z.enum(['up', 'down']),
      comment: z.string().max(2000).optional(),
    }).parse(req.body);
    const res = await query<{ id: string }>(
      `INSERT INTO feedback (project_id, message_id, task_id, user_telegram_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [body.projectId ?? null, body.messageId ?? null, body.taskId ?? null, req.telegramUser!.id, body.rating, body.comment ?? null],
    );
    return reply.code(201).send({ id: res.rows[0].id });
  });

  app.get('/feedback/aggregate', async (req) => {
    const q = req.query as { projectId?: string };
    return feedbackAggregate(q.projectId);
  });

  /** Feature flags (kill switch + per-project flags). */
  app.get('/feature-flags', async (req) => {
    const q = req.query as { projectId?: string };
    const res = await query(
      `SELECT * FROM feature_flags WHERE ($1::text IS NULL OR project_id=$1 OR project_id IS NULL) ORDER BY key ASC`,
      [q.projectId ?? null],
    );
    return { flags: res.rows };
  });

  app.post('/feature-flags', async (req, reply) => {
    const body = z.object({ key: z.string().min(1), enabled: z.boolean(), projectId: z.string().uuid().nullable().optional() }).parse(req.body);
    const res = await query<{ id: string }>(
      `INSERT INTO feature_flags (key, enabled, project_id) VALUES ($1,$2,$3)
       ON CONFLICT (key, project_id) DO UPDATE SET enabled=EXCLUDED.enabled RETURNING id`,
      [body.key, body.enabled, body.projectId ?? null],
    );
    return reply.code(201).send({ id: res.rows[0].id });
  });
}
