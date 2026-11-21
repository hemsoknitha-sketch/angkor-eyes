import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../lib/db';
import { requireTelegram, pagination } from '../lib/http';
import { audit } from '../services/audit';
import { taskDag } from '../services/task-dag';

const CreateProject = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  repoUrl: z.string().url().optional(),
  defaultBranch: z.string().default('main'),
  dailyBudgetUsd: z.number().positive().optional(),
});

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTelegram);

  app.get('/projects', async (req) => {
    const { limit, offset } = pagination(req);
    const res = await query(
      `SELECT * FROM projects WHERE owner_telegram_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.telegramUser!.id, limit, offset],
    );
    return { projects: res.rows };
  });

  app.post('/projects', async (req, reply) => {
    const body = CreateProject.parse(req.body);
    const res = await query<{ id: string }>(
      `INSERT INTO projects (name, description, repo_url, default_branch, owner_telegram_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [body.name, body.description ?? null, body.repoUrl ?? null, body.defaultBranch,
       req.telegramUser!.id, JSON.stringify({ daily_budget_usd: body.dailyBudgetUsd ?? null })],
    );
    await audit({ projectId: res.rows[0].id, userTelegramId: req.telegramUser!.id, eventType: 'project.created', actor: String(req.telegramUser!.id), detail: `project ${body.name} created` });
    return reply.code(201).send({ id: res.rows[0].id });
  });

  app.get('/projects/:id', async (req, reply) => {
    const res = await query(`SELECT * FROM projects WHERE id=$1 AND owner_telegram_id=$2`, [(req.params as { id: string }).id, req.telegramUser!.id]);
    if (res.rows.length === 0) return reply.code(404).send({ error: 'not_found' });
    return { project: res.rows[0] };
  });

  app.get('/projects/:id/dag', async (req) => {
    const projectId = (req.params as { id: string }).id;
    const res = await query(`SELECT * FROM tasks WHERE project_id=$1 ORDER BY created_at ASC`, [projectId]);
    return { tasks: res.rows };
  });

  app.post('/projects/:id/dag/standard', async (req) => {
    const projectId = (req.params as { id: string }).id;
    const body = z.object({ roomId: z.string().uuid(), title: z.string().min(1) }).parse(req.body);
    const dag = await taskDag.createStandardDag(projectId, body.roomId, body.title);
    return { dagId: dag.dagId, nodeIds: dag.nodeIds };
  });
}
