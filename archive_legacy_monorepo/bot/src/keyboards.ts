import { InlineKeyboard } from "grammy";

export function miniWebUrl(botUsername: string, startParam = ""): string {
  // Telegram Mini Web App opened via t.me/<bot>?startapp=<param>
  const base = botUsername ? `https://t.me/${botUsername.replace(/^@/, "")}` : "https://t.me/";
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
}

export function mainMenuKeyboard(botUsername: string): InlineKeyboard {
  return new InlineKeyboard()
    .webApp("🌐 បើក Mini Web · Open App", miniWebUrl(botUsername))
    .row()
    .text("🤖 ភ្នាក់ងារថ្មី · New Agent", "newagent")
    .text("🚶 Away Mode", "away_on")
    .row()
    .text("📋 បន្ទប់ · Rooms", "rooms")
    .text("❓ ជំនួយ · Help", "help");
}

export function approvalKeyboard(approvalId: string, botUsername: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ អនុម័ត · Approve", `approve:${approvalId}`)
    .text("⏳ មិនទាន់ · Not yet", `notyet:${approvalId}`)
    .row()
    .webApp("🔍 មើល Diff ក្នុង Mini Web · View Diff", miniWebUrl(botUsername, `approval:${approvalId}`))
    .row()
    .text("❌ បដិសេធ · Reject", `reject:${approvalId}`);
}

export function newAgentKeyboard(botUsername: string): InlineKeyboard {
  return new InlineKeyboard().webApp("➕ បង្កើតភ្នាក់ងារថ្មី · Add Agent", miniWebUrl(botUsername, "new-agent"));
}

export function awayKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("👋 ត្រឡប់មកវិញ · I'm Back", "back");
}
