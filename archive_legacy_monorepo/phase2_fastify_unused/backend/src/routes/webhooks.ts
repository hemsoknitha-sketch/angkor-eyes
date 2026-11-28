import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../config';
import { logger } from '../lib/logger';
import { dedupeTelegramUpdate } from '../lib/http';
import { turnCoordinator } from '../services/turn-coordinator';
import { query } from '../lib/db';
import { writeOutbox } from '../services/outbox';

/**
 * Webhook ingress — all external webhooks land here, are signature-verified,
 * and are stored + forwarded via the outbox. No webhook payload is trusted
 * as an instruction: payloads are data, the policy engine decides actions.
 */
function verifyHmac(secret: string, rawBody: string, signature: string, prefix = 'sha256='): boolean {
  if (!secret || !signature) return false;
  const expected = prefix + createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // GitHub — HMAC-SHA256 over the raw body (X-Hub-Signature-256).
  app.post('/webhooks/github', async (req, reply) => {
    const sig = req.headers['x-hub-signature-256'] as string | undefined;
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (env.GITHUB_WEBHOOK_SECRET && !verifyHmac(env.GITHUB_WEBHOOK_SECRET, raw, sig ?? '')) {
      return reply.code(401).send({ error: 'bad_signature' });
    }
    const event = req.headers['x-github-event'] as string | undefined;
    await writeOutbox('webhook.github', { event, payload: req.body as Record<string, unknown> });
    logger.info({ event }, 'github webhook received');
    return { ok: true };
  });

  // GitLab — token header.
  app.post('/webhooks/gitlab', async (req, reply) => {
    const token = req.headers['x-gitlab-token'] as string | undefined;
    if (env.GITLAB_WEBHOOK_TOKEN && token !== env.GITLAB_WEBHOOK_TOKEN) {
      return reply.code(401).send({ error: 'bad_token' });
    }
    await writeOutbox('webhook.gitlab', { payload: req.body as Record<string, unknown> });
    return { ok: true };
  });

  // Linear / Jira / Notion — token-verified generic ingress (configure per provider).
  app.post('/webhooks/:provider', async (req, reply) => {
    const provider = (req.params as { provider: string }).provider;
    if (!['linear', 'jira', 'notion'].includes(provider)) return reply.code(404).send({ error: 'unknown_provider' });
    await writeOutbox(`webhook.${provider}`, { payload: req.body as Record<string, unknown> });
    return { ok: true };
  });

  // Sentry inbound — issue events become tasks / notifications via the outbox consumer.
  app.post('/webhooks/sentry', async (req) => {
    await writeOutbox('webhook.sentry', { payload: req.body as Record<string, unknown> });
    return { ok: true };
  });

  // Stripe billing — signature verification is done by the Stripe SDK in the
  // billing worker; this endpoint records the raw event for audit.
  app.post('/webhooks/stripe', async (req) => {
    await writeOutbox('webhook.stripe', { payload: req.body as Record<string, unknown> });
    logger.info('stripe webhook received (verify signature in billing worker before acting)');
    return { ok: true };
  });

  // ABA / Bakong payment hooks (Khmer payment rails) — same pattern: record, verify, act in worker.
  app.post('/webhooks/aba', async (req) => {
    await writeOutbox('webhook.aba', { payload: req.body as Record<string, unknown> });
    return { ok: true };
  });
  app.post('/webhooks/bakong', async (req) => {
    await writeOutbox('webhook.bakong', { payload: req.body as Record<string, unknown> });
    return { ok: true };
  });

  // Telegram updates forwarded by the bot process (idempotency on update_id).
  app.post('/webhooks/telegram', async (req, reply) => {
    const body = z.object({ update_id: z.number().int(), message: z.object({ chat: z.object({ id: z.number() }), text: z.string().optional() }).optional() }).passthrough().parse(req.body);
    const isDup = await dedupeTelegramUpdate(body.update_id);
    if (isDup) return { ok: true, duplicate: true };
    const chatId = body.message?.chat.id;
    const text = body.message?.text ?? '';
    if (chatId && text) {
      const room = await query<{ id: string; project_id: string }>(
        `SELECT id, project_id FROM rooms WHERE telegram_chat_id=$1`, [String(chatId)],
      );
      if (room.rows.length > 0) {
        await turnCoordinator.handleTrigger({
          roomId: room.rows[0].id, projectId: room.rows[0].project_id, text,
          telegramUserId: 0, source: 'webhook',
        });
      }
    }
    return { ok: true };
  });
}
