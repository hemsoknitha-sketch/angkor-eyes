import { query } from '../lib/db';
import { logger } from '../lib/logger';
import { taskQueue, defaultJobOptions } from '../lib/redis';
import { turnCoordinator } from './turn-coordinator';

/**
 * Scheduled Tasks / Cron.
 * Schedules live in Postgres (scheduled_tasks, cron expression + next_run_at);
 * the scheduler ticks, claims due rows (SELECT ... FOR UPDATE SKIP LOCKED so
 * multiple backend replicas never double-fire), and enqueues the work.
 * Actual wall-clock ticking is driven by a BullMQ repeatable job registered
 * at boot (see startScheduler) — no external cron daemon required.
 */
export interface ScheduledTask {
  id: string;
  projectId: string;
  roomId: string | null;
  name: string;
  cron: string;
  prompt: string;
  enabled: boolean;
  nextRunAt: string | null;
}

export async function createScheduledTask(input: Omit<ScheduledTask, 'id' | 'nextRunAt'> & { nextRunAt?: string }): Promise<ScheduledTask> {
  const res = await query<ScheduledTask>(
    `INSERT INTO scheduled_tasks (project_id, room_id, name, cron, prompt, enabled, next_run_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, project_id AS "projectId", room_id AS "roomId",
     name, cron, prompt, enabled, next_run_at AS "nextRunAt"`,
    [input.projectId, input.roomId, input.name, input.cron, input.prompt, input.enabled, input.nextRunAt ?? null],
  );
  return res.rows[0];
}

/** Claim due tasks and fire them once. Safe to run concurrently (SKIP LOCKED). */
export async function tickScheduler(now = new Date()): Promise<number> {
  const due = await query<{ id: string; project_id: string; room_id: string | null; prompt: string; cron: string }>(
    `SELECT id, project_id, room_id, prompt, cron FROM scheduled_tasks
     WHERE enabled=true AND (next_run_at IS NULL OR next_run_at <= $1)
     ORDER BY next_run_at ASC LIMIT 20 FOR UPDATE SKIP LOCKED`,
    [now],
  );
  for (const task of due.rows) {
    await query(`UPDATE scheduled_tasks SET last_run_at=now() WHERE id=$1`, [task.id]);
    if (task.room_id) {
      await turnCoordinator.handleTrigger({
        roomId: task.room_id, projectId: task.project_id, text: task.prompt,
        telegramUserId: 0, source: 'schedule',
      });
    } else {
      await taskQueue.add('scheduled-task', { scheduledTaskId: task.id, prompt: task.prompt }, defaultJobOptions);
    }
    logger.info({ scheduledTaskId: task.id }, 'scheduled task fired');
  }
  return due.rows.length;
}

export async function startScheduler(): Promise<void> {
  // Repeatable job: tick every minute. BullMQ dedupes by job id.
  await taskQueue.add('scheduler-tick', {}, { ...defaultJobOptions, repeat: { pattern: '* * * * *' }, jobId: 'scheduler-tick' });
  logger.info('scheduler repeatable job registered (every minute)');
}
