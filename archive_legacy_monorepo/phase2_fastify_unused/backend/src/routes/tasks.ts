import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../lib/db';
import { requireTelegram, pagination } from '../lib/http';
import { taskDag, type TaskStatus } from '../services/task-dag';
import { audit } from '../services/audit';

const CreateTask = z.object({
  projectId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  agentId: z.string().uuid().optional(),
});

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTelegram);

  app.get('/tasks', async (req) => {
    const { limit, offset } = pagination(req);
    const q = req.query as { projectId?: string; status?: string };
    const res = await query(
      `SELECT * FROM tasks WHERE ($1::text IS NULL OR project_id=$1) AND ($2::text IS NULL OR status=$2)
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [q.projectId ?? null, q.status ?? null, limit, offset],
    );
    return { tasks: res.rows };
  });

  app.post('/tasks', async (req, reply) => {
    const body = CreateTask.parse(req.body);
    const res = await query<{ id: string }>(
      `INSERT INTO tasks (project_id, room_id, title, description, status, agent_id, created_by)
       VALUES ($1,$2,$3,$4,'queued',$5,$6) RETURNING id`,
      [body.projectId, body.roomId ?? null, body.title, body.description ?? null,
       body.agentId ?? null, String(req.telegramUser!.id)],
    );
    return reply.code(201).send({ id: res.rows[0].id });
  });

  app.get('/tasks/:id', async (req, reply) => {
    const res = await query(`SELECT * FROM tasks WHERE id=$1`, [(req.params as { id: string }).id]);
    if (res.rows.length === 0) return reply.code(404).send({ error: 'not_found' });
    const checkpoints = await query(`SELECT * FROM task_checkpoints WHERE task_id=$1 ORDER BY created_at ASC`, [(req.params as { id: string }).id]);
    return { task: res.rows[0], checkpoints: checkpoints.rows };
  });

  app.post('/tasks/:id/transition', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = z.object({ status: z.enum(['queued', 'running', 'waiting_approval', 'paused', 'failed', 'completed', 'cancelled']), detail: z.string().optional() }).parse(req.body);
    try {
      await taskDag.transition(id, body.status as TaskStatus, body.detail);
    } catch (err) {
      return reply.code(400).send({ error: String(err) });
    }
    return { ok: true, status: body.status };
  });

  app.post('/tasks/:id/cancel', async (req) => {
    await taskDag.cancel((req.params as { id: string }).id, 'cancelled via API');
    return { ok: true };
  });

  app.post('/tasks/:id/pause', async (req) => {
    await taskDag.pause((req.params as { id: string }).id);
    return { ok: true };
  });

  app.post('/tasks/:id/resume', async (req) => {
    const checkpoint = await taskDag.resume((req.params as { id: string }).id);
    return { ok: true, checkpoint };
  });

  app.get('/tasks/:id/dead-letter', async (req) => {
    const res = await query(`SELECT * FROM dead_letter_queue WHERE task_id=$1 ORDER BY created_at DESC`, [(req.params as { id: string }).id]);
    return { entries: res.rows };
  });

  app.get('/search', async (req) => {
    // Postgres FTS + pgvector semantic search over tasks/messages (see memory route for memories).
    const q = req.query as { q?: string; projectId?: string };
    if (!q.q) return { results: [] };
    const res = await query(
      `SELECT 'task' AS kind, id, title AS text FROM tasks
       WHERE ($2::text IS NULL OR project_id=$2) AND to_tsvector('english', title || ' ' || COALESCE(description,'')) @@ plainto_tsquery('english', $1)
       UNION ALL
       SELECT 'message' AS kind, id, content AS text FROM messages
       WHERE ($2::text IS NULL OR project_id=$2) AND to_tsvector('english', content) @@ plainto_tsquery('english', $1)
       LIMIT 50`,
      [q.q, q.projectId ?? null],
    );
    return { results: res.rows };
  });
}
