import { query } from '../lib/db';
import { logger } from '../lib/logger';
import { listPendingApprovals } from './approval-service';
import { writeOutbox } from './outbox';

/**
 * Away Mode: the user is away; agents keep working autonomously on safe work,
 * risky work pauses for approval, non-critical notifications are muted,
 * and everything is recorded on a Timeline. On return, a Welcome Back Digest
 * summarises what finished and what needs approval.
 */
export interface AwayState {
  userTelegramId: number;
  away: boolean;
  since: string | null;
  muteNonCritical: boolean;
}

export async function setAwayMode(userTelegramId: number, away: boolean): Promise<AwayState> {
  await query(
    `INSERT INTO users (telegram_id, away_mode, away_since) VALUES ($1,$2, now())
     ON CONFLICT (telegram_id) DO UPDATE SET away_mode=$2, away_since=CASE WHEN $2 THEN now() ELSE NULL END`,
    [userTelegramId, away],
  );
  if (!away) {
    // Returning: pause nothing, the digest is generated on demand by getWelcomeBackDigest().
    logger.info({ userTelegramId }, 'user returned from away mode');
  }
  await writeOutbox(away ? 'away.enabled' : 'away.disabled', { user_telegram_id: userTelegramId });
  return getAwayState(userTelegramId);
}

export async function getAwayState(userTelegramId: number): Promise<AwayState> {
  const res = await query<{ away_mode: boolean; away_since: string | null }>(
    `SELECT away_mode, away_since FROM users WHERE telegram_id=$1`, [userTelegramId],
  );
  return {
    userTelegramId,
    away: res.rows[0]?.away_mode ?? false,
    since: res.rows[0]?.away_since ?? null,
    muteNonCritical: res.rows[0]?.away_mode ?? false,
  };
}

/** Risky work pauses while away; safe work continues. */
export async function shouldPauseRiskyWork(userTelegramId: number): Promise<boolean> {
  const state = await getAwayState(userTelegramId);
  return state.away;
}

export interface WelcomeBackDigest {
  since: string | null;
  tasksCompleted: Array<{ id: string; title: string }>;
  tasksFailed: Array<{ id: string; title: string }>;
  pendingApprovals: unknown[];
  timeline: Array<{ at: string; event: string; detail: string }>;
}

export async function getWelcomeBackDigest(userTelegramId: number, projectId?: string): Promise<WelcomeBackDigest> {
  const state = await getAwayState(userTelegramId);
  const since = state.since ?? new Date(Date.now() - 24 * 3600_000).toISOString();
  const completed = await query<{ id: string; title: string }>(
    `SELECT id, title FROM tasks WHERE status='completed' AND updated_at >= $1
     AND ($2::text IS NULL OR project_id=$2) ORDER BY updated_at DESC LIMIT 50`,
    [since, projectId ?? null],
  );
  const failed = await query<{ id: string; title: string }>(
    `SELECT id, title FROM tasks WHERE status='failed' AND updated_at >= $1
     AND ($2::text IS NULL OR project_id=$2) ORDER BY updated_at DESC LIMIT 50`,
    [since, projectId ?? null],
  );
  const pendingApprovals = await listPendingApprovals(projectId);
  const timeline = await query<{ at: string; event: string; detail: string }>(
    `SELECT created_at AS at, event_type AS event, detail FROM audit_logs
     WHERE created_at >= $1 AND ($2::text IS NULL OR project_id=$2)
     ORDER BY created_at DESC LIMIT 100`,
    [since, projectId ?? null],
  );
  return {
    since,
    tasksCompleted: completed.rows,
    tasksFailed: failed.rows,
    pendingApprovals,
    timeline: timeline.rows,
  };
}
