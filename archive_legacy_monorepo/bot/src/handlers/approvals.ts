import type { AppContext } from "../types.js";
import { approvalKeyboard } from "../keyboards.js";

/** Send an approval alert with [Approve] [View Diff in Mini Web] [Reject]/[Not yet]. */
export async function sendApprovalAlert(
  ctx: AppContext,
  approval: { id: string; title: string; summary: string; diffUrl?: string },
  botUsername: string,
) {
  const text =
    `🔔 ត្រូវការការអនុម័ត · Approval needed\n\n` +
    `📌 ${approval.title}\n${approval.summary}\n` +
    (approval.diffUrl ? `\n🔍 Diff: ${approval.diffUrl}` : "");
  await ctx.reply(text, { reply_markup: approvalKeyboard(approval.id, botUsername) });
}

function decisionLabel(d: "approve" | "reject" | "not_yet") {
  return d === "approve" ? "✅ អនុម័ត · Approved" : d === "reject" ? "❌ បដិសេធ · Rejected" : "⏳ មិនទាន់ · Not yet";
}

export async function handleApprovalCallback(ctx: AppContext, raw: string, botUsername: string) {
  const [action, approvalId] = raw.split(":");
  if (!approvalId || !ctx.from) return;
  const decision = action === "approve" ? "approve" : action === "reject" ? "reject" : "not_yet";
  await ctx.answerCallbackQuery({ text: "កំពុងដំណើរការ… · Processing…" });
  try {
    await ctx.backend.decideApproval({ approvalId, decision, telegramId: ctx.from.id });
    const label = decisionLabel(decision);
    await ctx.editMessageText(
      `${label}\n\n${ctx.callbackQuery?.message?.text ?? ""}`.slice(0, 4000),
    ).catch(() => undefined);
    await ctx.reply(`${label} — ការអនុម័ត ${approvalId} ត្រូវបានកត់ត្រាហើយ។`);
  } catch (err) {
    console.error("decideApproval failed", err);
    await ctx.reply("⚠️ មិនអាចកត់ត្រាការសម្រេចចិត្តបានទេ សូមព្យាយាមម្តងទៀត។\n⚠️ Could not record the decision — please try again.");
  }
  void botUsername;
}
