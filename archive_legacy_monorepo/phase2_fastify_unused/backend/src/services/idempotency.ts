import { query } from '../lib/db';
import { logger } from '../lib/logger';

/**
 * Idempotency: Telegram update_id dedupe + generic idempotency keys.
 * A key is claimed atomically (INSERT ... ON CONFLICT DO NOTHING); the
 * second caller with the same key gets the stored result instead of re-running.
 */
export async function claimIdempotencyKey(key: string, scope: string, ttlSeconds = 86_400): Promise<boolean> {
  const res = await query(
    `INSERT INTO idempotency_keys (key, scope, expires_at)
     VALUES ($1, $2, now() + ($3 || ' seconds')::interval)
     ON CONFLICT (key, scope) DO NOTHING RETURNING key`,
    [key, scope, String(ttlSeconds)],
  );
  return res.rowCount === 1;
}

export async function isDuplicateTelegramUpdate(updateId: number): Promise<boolean> {
  // claim returns true the first time; false means we already processed it.
  const first = await claimIdempotencyKey(`telegram:${updateId}`, 'telegram_update');
  if (!first) logger.info({ updateId }, 'duplicate telegram update ignored');
  return !first;
}

export async function storeIdempotencyResult(key: string, scope: string, statusCode: number, body: unknown): Promise<void> {
  await query(
    `UPDATE idempotency_keys SET status_code=$3, response_body=$4 WHERE key=$1 AND scope=$2`,
    [key, scope, statusCode, JSON.stringify(body)],
  );
}

export async function getIdempotencyResult(key: string, scope: string): Promise<{ statusCode: number; body: unknown } | null> {
  const res = await query<{ status_code: number; response_body: string }>(
    `SELECT status_code, response_body FROM idempotency_keys WHERE key=$1 AND scope=$2 AND expires_at > now()`,
    [key, scope],
  );
  if (res.rows.length === 0) return null;
  return { statusCode: res.rows[0].status_code, body: JSON.parse(res.rows[0].response_body ?? 'null') };
}
