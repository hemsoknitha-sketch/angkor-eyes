import IORedis from 'ioredis';
import { Queue, Worker, type JobsOptions } from 'bullmq';
import { env } from '../config';
import { logger } from './logger';

/** Redis: queue / distributed lock / realtime only — never the source of truth. */
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});
redis.on('error', (err) => logger.error({ err }, 'redis error'));

export const redisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const QUEUES = {
  tasks: 'angkor-tasks',
  notifications: 'angkor-notifications',
  outbox: 'angkor-outbox',
  scheduler: 'angkor-scheduler',
  merge: 'angkor-merge',
} as const; // BullMQ queue names may not contain ':' — Redis keys elsewhere may.

export function makeQueue(name: string): Queue {
  return new Queue(name, { connection: redisConnection });
}

export const taskQueue = makeQueue(QUEUES.tasks);
export const notificationQueue = makeQueue(QUEUES.notifications);
export const outboxQueue = makeQueue(QUEUES.outbox);
export const mergeQueue = makeQueue(QUEUES.merge);

export const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 1000 },
};

/** Distributed lock helpers (room_lock:<room_id>). Returns a release function or null. */
export async function acquireLock(key: string, ttlMs: number, owner = crypto.randomUUID()): Promise<(() => Promise<void>) | null> {
  const ok = await redis.set(key, owner, 'PX', ttlMs, 'NX');
  if (ok !== 'OK') return null;
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    // Release only if we still own the lock (Lua compare-and-delete).
    await redis.eval(
      `if redis.call("get",KEYS[1])==ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end`,
      1, key, owner,
    );
  };
}

export function roomLockKey(roomId: string): string {
  return `room_lock:${roomId}`;
}

export async function publish(channel: string, payload: unknown): Promise<void> {
  await redis.publish(channel, JSON.stringify(payload));
}

export async function closeRedis(): Promise<void> {
  redis.disconnect();
  redisConnection.disconnect();
  await taskQueue.close();
  await notificationQueue.close();
  await outboxQueue.close();
  await mergeQueue.close();
}

export type { Worker };
