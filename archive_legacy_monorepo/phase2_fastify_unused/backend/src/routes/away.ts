import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTelegram } from '../lib/http';
import { setAwayMode, getAwayState, getWelcomeBackDigest } from '../services/away-mode';

export async function awayRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTelegram);

  app.get('/away', async (req) => getAwayState(req.telegramUser!.id));

  app.post('/away', async (req) => {
    const body = z.object({ away: z.boolean() }).parse(req.body);
    return setAwayMode(req.telegramUser!.id, body.away);
  });

  /** Welcome Back Digest: tasks done, tasks failed, pending approvals, timeline. */
  app.get('/away/digest', async (req) => {
    const q = req.query as { projectId?: string };
    return getWelcomeBackDigest(req.telegramUser!.id, q.projectId);
  });
}
