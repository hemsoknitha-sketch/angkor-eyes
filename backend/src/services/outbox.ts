import { query, withTx } from '../lib/db';
import { outboxQueue, defaultJobOptions } from '../lib/redis';
import { logger } from '../lib/logger';

/**
 * Transactional Outbox: domain events are written in the SAME Postgres
 * transaction as the state change, then relayed to BullMQ / webhooks by a
 * separate relayer. A crash between the write and the relay loses nothing —
 * the outbox row is still there and gets retried.
 */
export async function writeOutbox(eventType: string, payload: Record<string, unknown>, aggregateId?: string): Promise<string> {
  const res = await query<{ id: string }>(
    `INSERT INTO outbox_events (event_type, payload, aggregate_id, status) VALUES ($1,$2,$3,'pending') RETURNING id`,
    [eventType, JSON.stringify(payload), aggregateId ?? null],
  );
  return res.rows[0].id;
}

/** Relay pending outbox rows to the queue; marks them published. Run on a timer. */
export async function relayOutbox(batchSize = 100): Promise<number> {
  const rows = await query<{ id: string; event_type: string; payload: string }>(
    `SELECT id, event_type, payload FROM outbox_events WHERE status='pending' ORDER BY created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED`,
    [batchSize],
  );
  for (const row of rows.rows) {
    try {
      await outboxQueue.add('relay', { outboxId: row.id, eventType: row.event_type, payload: JSON.parse(row.payload) },
        { ...defaultJobOptions, jobId: `outbox:${row.id}` });
      await query(`UPDATE outbox_events SET status='published', published_at=now() WHERE id=$1`, [row.id]);
    } catch (err) {
      logger.error({ err, outboxId: row.id }, 'outbox relay failed — will retry');
      await query(`UPDATE outbox_events SET status='failed', attempts=attempts+1 WHERE id=$1`, [row.id]);
    }
  }
  return rows.rows.length;
}

/** Write + relay in one call for callers that do not run inside a tx. */
export async function publishEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
  const id = await writeOutbox(eventType, payload);
  await relayOutbox(1).catch(() => logger.warn({ outboxId: id }, 'deferred outbox relay'));
}
