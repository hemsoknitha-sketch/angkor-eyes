import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query } from '../lib/db';
import { requireTelegram } from '../lib/http';
import { sha256Hex } from '../lib/secrets-redaction';

/**
 * Public API + API keys.
 * Keys are shown ONCE at creation; only the SHA-256 hash is stored.
 * Scopes limit what a key may do (e.g. read-only, tasks:write).
 * Outbound webhooks (project-level) are registered here too.
 */
const SCOPES = ['read', 'tasks:read', 'tasks:write', 'rooms:write', 'approvals:read'] as const;

export async function apiKeyAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = req.headers['x-api-key'] as string | undefined;
  if (!key) {
    void reply.code(401).send({ error: 'unauthorized', message: 'x-api-key required' });
    return;
  }
  const res = await query<{ id: string; scopes: string[]; project_id: string | null }>(
    `SELECT id, scopes, project_id FROM api_keys WHERE key_hash=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
    [sha256Hex(key)],
  );
  if (res.rows.length === 0) {
    void reply.code(401).send({ error: 'unauthorized', message: 'invalid api key' });
    return;
  }
  await query(`UPDATE api_keys SET last_used_at=now() WHERE id=$1`, [res.rows[0].id]);
  req.apiKeyScopes = res.rows[0].scopes;
}

export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  // Key management requires a Telegram user; the public API itself uses apiKeyAuth.
  app.addHook('preHandler', requireTelegram);

  app.get('/api-keys', async (req) => {
    const res = await query(
      `SELECT id, name, scopes, project_id, last_used_at, expires_at, created_at FROM api_keys
       WHERE owner_telegram_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC`,
      [req.telegramUser!.id],
    );
    return { keys: res.rows };
  });

  app.post('/api-keys', async (req, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      scopes: z.array(z.enum(SCOPES)).default(['read']),
      projectId: z.string().uuid().nullable().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
    }).parse(req.body);
    const rawKey = `ak_${randomBytes(24).toString('hex')}`;
    const res = await query<{ id: string }>(
      `INSERT INTO api_keys (name, key_hash, scopes, project_id, owner_telegram_id, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [body.name, sha256Hex(rawKey), body.scopes, body.projectId ?? null, req.telegramUser!.id, body.expiresAt ?? null],
    );
    // Show the raw key exactly once — it is never stored.
    return reply.code(201).send({ id: res.rows[0].id, key: rawKey, scopes: body.scopes });
  });

  app.post('/api-keys/:id/revoke', async (req) => {
    await query(`UPDATE api_keys SET revoked_at=now() WHERE id=$1 AND owner_telegram_id=$2`,
      [(req.params as { id: string }).id, req.telegramUser!.id]);
    return { ok: true };
  });

  /** Outbound webhooks: register a URL to receive project events. */
  app.post('/outbound-webhooks', async (req, reply) => {
    const body = z.object({
      projectId: z.string().uuid(),
      url: z.string().url(),
      events: z.array(z.string()).min(1),
    }).parse(req.body);
    const res = await query<{ id: string }>(
      `INSERT INTO outbox_events (event_type, payload, aggregate_id, status)
       VALUES ('webhook.outbound.registered', $1, $2, 'pending') RETURNING id`,
      [JSON.stringify({ project_id: body.projectId, url: body.url, events: body.events }), body.projectId],
    );
    return reply.code(201).send({ id: res.rows[0].id });
  });
}
