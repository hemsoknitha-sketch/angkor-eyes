import type { FastifyInstance } from 'fastify';
import { requireTelegram, pagination } from '../lib/http';
import { listAuditLogs } from '../services/audit';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTelegram);
  app.get('/audit-logs', async (req) => {
    const { limit, offset } = pagination(req);
    const q = req.query as { projectId?: string };
    return { logs: await listAuditLogs({ projectId: q.projectId, limit, offset }) };
  });
}
