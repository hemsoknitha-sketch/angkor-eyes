import type { NextFunction } from "grammy";
import type { AppContext } from "../types.js";

/**
 * Dedupe by Telegram update_id. Telegram may redeliver an update after a
 * timeout; without this a task could be created twice.
 * In-memory LRU-ish set is enough for a single process; for multi-instance
 * deployments replace with Redis (SETNX update_id, TTL 24h).
 */
const seen = new Set<number>();
const MAX_SEEN = 10_000;

export function idempotencyMiddleware() {
  return async (ctx: AppContext, next: NextFunction) => {
    const updateId = ctx.update.update_id;
    if (seen.has(updateId)) return; // duplicate delivery — drop silently
    seen.add(updateId);
    if (seen.size > MAX_SEEN) {
      // Evict oldest ~10% (insertion order is preserved by Set).
      const drop = Math.floor(MAX_SEEN / 10);
      let i = 0;
      for (const id of seen) { seen.delete(id); if (++i >= drop) break; }
    }
    await next();
  };
}
