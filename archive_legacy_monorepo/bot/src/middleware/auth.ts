import type { NextFunction } from "grammy";
import type { AppContext } from "../types.js";

/**
 * ALLOWED_TELEGRAM_IDS whitelist.
 * If the env list is empty, the bot refuses everyone except nobody — fail
 * closed and tell the owner to set it. Never silently allow all.
 */
export function authMiddleware(allowedIds: Set<number>) {
  return async (ctx: AppContext, next: NextFunction) => {
    const id = ctx.from?.id;
    ctx.telegramId = id;
    if (!id) return; // no sender (e.g. channel post without author) — ignore
    if (allowedIds.size === 0) {
      await ctx.reply("⛔ បូតនេះមិនទាន់បានកំណត់ ALLOWED_TELEGRAM_IDS ទេ។\n⛔ This bot has no ALLOWED_TELEGRAM_IDS configured yet.");
      return;
    }
    if (!allowedIds.has(id)) {
      await ctx.reply("⛔ អ្នកមិនមានសិទ្ធិប្រើប្រាស់ ANGKOR EYES ទេ។\n⛔ You are not authorized to use ANGKOR EYES.");
      return;
    }
    await next();
  };
}
