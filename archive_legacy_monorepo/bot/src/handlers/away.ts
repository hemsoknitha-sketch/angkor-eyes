import type { AppContext } from "../types.js";
import { awayKeyboard } from "../keyboards.js";

/** /away — enable Away Mode. Agents keep working; approvals queue up. */
export async function handleAway(ctx: AppContext) {
  if (!ctx.from) return;
  try { await ctx.backend.setAway({ telegramId: ctx.from.id, away: true }); } catch (e) { console.error("setAway failed", e); }
  ctx.session.away = true;
  await ctx.reply(
    "🚶 Away Mode បានបើកហើយ។ ភ្នាក់ងារនឹងបន្តធ្វើការ ហើយការអនុម័តនឹងរង់ចាំអ្នក។ ប្រើ /back ពេលត្រឡប់មកវិញ។\n" +
      "🚶 Away Mode is on. Agents keep working; approvals will wait for you. Use /back when you return.",
    { reply_markup: awayKeyboard() },
  );
}

/** /back — return + Welcome Back Digest summary immediately. */
export async function handleBack(ctx: AppContext) {
  if (!ctx.from) return;
  try { await ctx.backend.setAway({ telegramId: ctx.from.id, away: false }); } catch (e) { console.error("setAway failed", e); }
  ctx.session.away = false;
  await ctx.reply("👋 ស្វាគមន៍ត្រឡប់មកវិញ! កំពុងរៀបចំសង្ខេប…\n👋 Welcome back! Preparing your digest…");
  try {
    const d = await ctx.backend.getAwayDigest(ctx.from.id);
    const lines = d.timeline.slice(0, 15).map((t) => `• ${t.at} — ${t.text}`).join("\n") || "• គ្មានសកម្មភាពថ្មី · No new activity";
    await ctx.reply(
      `📬 Welcome Back Digest\n\n✅ បានបញ្ចប់ ${d.completed} កិច្ចការ · ${d.completed} tasks done\n🔔 រង់ចាំអនុម័ត ${d.pendingApprovals} · ${d.pendingApprovals} pending approvals\n\n${lines}`,
    );
  } catch (err) {
    console.error("away digest failed", err);
    await ctx.reply("📬 Welcome Back Digest មិនអាចទាញបានទេ ប៉ុន្តែ Away Mode បានបិទហើយ។\n📬 Digest unavailable, but Away Mode is now off.");
  }
}
