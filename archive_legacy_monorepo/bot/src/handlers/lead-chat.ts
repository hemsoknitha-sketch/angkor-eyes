import type { AppContext } from "../types.js";

/** 1-on-1 chat with the Lead Agent. Small talk is answered locally; large tasks go to the backend. */
const SMALL_TALK = /^(hi|hello|hey|សួស្តី|ជំរាបសួរ|ok|អរគុណ|thanks?|thank you)\b/i;

export async function handleLeadChat(ctx: AppContext) {
  const text = ctx.message?.text?.trim();
  if (!text || !ctx.from || !ctx.chat || !ctx.message) return;
  if (SMALL_TALK.test(text)) {
    await ctx.reply(
      "សួស្តី! ខ្ញុំជា Lead Agent របស់ ANGKOR EYES។ ប្រាប់ខ្ញុំពីកិច្ចការធំៗ — ខ្ញុំនឹងបែងចែកឲ្យ Dev / QA / Reviewer ធ្វើ។\n" +
        "Hello! I'm the Lead Agent. Give me a large task and I'll split it across Dev / QA / Reviewer.",
    );
    return;
  }
  await ctx.replyWithChatAction("typing");
  const thinking = await ctx.reply("⏳ Lead Agent កំពុងគិត… · Thinking…");
  const editThinking = (t: string) => ctx.api.editMessageText(thinking.chat.id, thinking.message_id, t);
  try {
    const res = await ctx.backend.leadChat({
      telegramId: ctx.from.id,
      chatId: ctx.chat.id,
      text,
      messageId: ctx.message.message_id,
    });
    if (res.taskId) ctx.session.lastTaskId = res.taskId;
    await editThinking(res.reply ?? res.summary ?? "✅ បានទទួលកិច្ចការ — Lead Agent កំពុងដំណើរការ។\n✅ Task received — the Lead Agent is working on it.");
  } catch (err) {
    console.error("leadChat failed", err);
    await editThinking(
      "⚠️ មិនអាចភ្ជាប់ទៅ Backend បានទេ (BACKEND_URL)។ កិច្ចការរបស់អ្នកមិនទាន់បានផ្ញើទេ សូមព្យាយាមម្តងទៀត។\n" +
        "⚠️ Could not reach the backend. Your task was not sent — please try again.",
    );
  }
}

/** Concise summary sent when a group chat / room task finishes. */
export async function sendRoomSummary(ctx: AppContext, roomId: string) {
  try {
    const { summary } = await ctx.backend.roomSummary(roomId);
    await ctx.reply(`📋 សង្ខេបបន្ទប់បានបញ្ចប់ · Room finished:\n\n${summary}`);
  } catch (err) {
    console.error("roomSummary failed", err);
    await ctx.reply("📋 បន្ទប់បានបញ្ចប់ ប៉ុន្តែមិនអាចទាញសង្ខេបបានទេ។\n📋 Room finished, but the summary could not be loaded.");
  }
}
