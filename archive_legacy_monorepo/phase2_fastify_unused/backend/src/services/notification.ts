import { query } from '../lib/db';
import { notificationQueue, defaultJobOptions } from '../lib/redis';
import { logger } from '../lib/logger';
import { getAwayState } from './away-mode';

export type NotificationKind = 'approval_needed' | 'task_completed' | 'task_failed' | 'mention' | 'digest' | 'info';
export type NotificationChannel = 'telegram' | 'webhook';

/**
 * Notifications. In Away Mode non-critical notifications are muted
 * (stored, delivered in the Welcome Back Digest); approval_needed and
 * task_failed are critical and still go out.
 */
const CRITICAL: Set<NotificationKind> = new Set(['approval_needed', 'task_failed']);

export async function notify(input: {
  userTelegramId: number;
  projectId?: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  channel?: NotificationChannel;
}): Promise<{ delivered: boolean; muted: boolean }> {
  const away = await getAwayState(input.userTelegramId);
  const muted = away.away && !CRITICAL.has(input.kind);
  await query(
    `INSERT INTO notifications (user_telegram_id, project_id, kind, title, body, channel, delivered)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [input.userTelegramId, input.projectId ?? null, input.kind, input.title, input.body, input.channel ?? 'telegram', !muted],
  );
  if (muted) {
    logger.info({ userTelegramId: input.userTelegramId, kind: input.kind }, 'notification muted (away mode)');
    return { delivered: false, muted: true };
  }
  // Delivery itself is done by the bot / webhook worker reading this queue.
  await notificationQueue.add('send', {
    userTelegramId: input.userTelegramId, kind: input.kind,
    title: input.title, body: input.body, channel: input.channel ?? 'telegram',
  }, defaultJobOptions);
  return { delivered: true, muted: false };
}

export async function listNotifications(userTelegramId: number, limit = 50): Promise<unknown[]> {
  const res = await query(
    `SELECT * FROM notifications WHERE user_telegram_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [userTelegramId, limit],
  );
  return res.rows;
}
