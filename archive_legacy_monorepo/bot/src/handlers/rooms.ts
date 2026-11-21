import type { AppContext } from "../types.js";
import { sendRoomSummary } from "./lead-chat.js";

/** List project rooms (e.g. my-shop, launch-day) and let the user pick one. */
export async function handleRooms(ctx: AppContext, botUsername: string) {
  if (!ctx.from) return;
  try {
    const { rooms } = await ctx.backend.listRooms(ctx.from.id);
    if (!rooms.length) {
      await ctx.reply("📋 មិនទាន់មានបន្ទប់ទេ។ បង្កើតបន្ទប់ដំបូងក្នុង Mini Web។\n📋 No rooms yet. Create your first room in the Mini Web app.");
      return;
    }
    const { InlineKeyboard } = await import("grammy");
    const kb = new InlineKeyboard();
    for (const r of rooms) kb.text(`📁 ${r.name}`, `room:${r.id}`).row();
    kb.webApp("🌐 បើកបន្ទប់ក្នុង Mini Web", `https://t.me/${botUsername.replace(/^@/, "")}?startapp=rooms`);
    await ctx.reply("📋 បន្ទប់របស់អ្នក · Your rooms:", { reply_markup: kb });
  } catch (err) {
    console.error("listRooms failed", err);
    await ctx.reply("⚠️ មិនអាចទាញបញ្ជីបន្ទប់បានទេ។\n⚠️ Could not load rooms.");
  }
}

export async function handleRoomPick(ctx: AppContext, roomId: string) {
  ctx.session.roomId = roomId;
  await ctx.answerCallbackQuery({ text: "បន្ទប់ត្រូវបានជ្រើសរើស · Room selected" });
  await ctx.reply(`📁 អ្នកកំពុងនៅក្នុងបន្ទប់ ${roomId}។ ផ្ញើសារដើម្បីនិយាយជាមួយភ្នាក់ងារក្នុងបន្ទប់នេះ។\n📁 You are now in room ${roomId}. Send a message to talk to its agents.`);
}

/** Called by the backend (via webhook handler in index.ts) when a room finishes. */
export async function handleRoomFinished(ctx: AppContext, roomId: string) {
  await sendRoomSummary(ctx, roomId);
}
