import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTelegram, pagination } from '../lib/http';
import { requestApproval, decideApproval, listPendingApprovals } from '../services/approval-service';
import { checkPolicy } from '../services/policy-engine';

const RequestApproval = z.object({
  projectId: z.string().uuid(),
  roomId: z.string().uuid(),
  targetRepo: z.string().min(1),
  branchName: z.string().min(1),
  targetCommitSha: z.string().min(7),
  requestedAction: z.string().min(1),
  requestedByAgent: z.string().uuid(),
  actionPayload: z.record(z.unknown()).default({}),
});

export async function approvalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTelegram);

  app.get('/approvals', async (req) => {
    const { limit, offset } = pagination(req);
    const q = req.query as { projectId?: string };
    const rows = await listPendingApprovals(q.projectId);
    return { approvals: (rows as unknown[]).slice(offset, offset + limit) };
  });

  app.post('/approvals', async (req, reply) => {
    const body = RequestApproval.parse(req.body);
    const policy = await checkPolicy(body.requestedByAgent, body.requestedAction);
    if (!policy.allowed) return reply.code(403).send({ error: 'policy_denied', reason: policy.reason });
    const approval = await requestApproval(body);
    return reply.code(201).send(approval);
  });

  app.post('/approvals/:id/decide', async (req, reply) => {
    const body = z.object({ approved: z.boolean() }).parse(req.body);
    try {
      const status = await decideApproval((req.params as { id: string }).id, body.approved, req.telegramUser!.id);
      return { ok: true, status };
    } catch (err) {
      return reply.code(400).send({ error: String(err) });
    }
  });
}
