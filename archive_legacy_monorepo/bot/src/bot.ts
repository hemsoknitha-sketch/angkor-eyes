import { Bot, session } from "grammy";
import type { BotConfig } from "./config.js";
import { BackendClient } from "./lib/api.js";
import type { AppContext, SessionData } from "./types.js";
import { authMiddleware } from "./middleware/auth.js";
import { idempotencyMiddleware } from "./middleware/idempotency.js";
import { registerCommands } from "./commands.js";
import { handleLeadChat } from "./handlers/lead-chat.js";
import { handleApprovalCallback } from "./handlers/approvals.js";
import { handleAway, handleBack } from "./handlers/away.js";
import { handleRoomPick, handleRooms } from "./handlers/rooms.js";

export function createBot(config: BotConfig) {
  const bot = new Bot<AppContext>(config.token);
  const api = new BackendClient({ backendUrl: config.backendUrl });

  bot.use(async (ctx, next) => { ctx.backend = api; await next(); });
  bot.use(session({ initial: (): SessionData => ({ away: false }) }));
  bot.use(idempotencyMiddleware());
  bot.use(authMiddleware(config.allowedIds));

  bot.api.setMyCommands([
    { command: "start", description: "ចាប់ផ្តើម · Start" },
    { command: "newagent", description: "ភ្នាក់ងារថ្មី · New agent" },
    { command: "away", description: "Away Mode" },
    { command: "back", description: "ត្រឡប់មកវិញ · I'm back" },
    { command: "schedule", description: "កាលវិភាគ · Schedule" },
    { command: "help", description: "ជំនួយ · Help" },
  ]).catch((e) => console.error("setMyCommands failed", e));

  registerCommands(bot, config.botUsername);

  // Inline-button callbacks
  bot.callbackQuery(/^approve:/, async (ctx) => { await handleApprovalCallback(ctx, ctx.callbackQuery.data ?? "", config.botUsername); });
  bot.callbackQuery(/^reject:/, async (ctx) => { await handleApprovalCallback(ctx, ctx.callbackQuery.data ?? "", config.botUsername); });
  bot.callbackQuery(/^notyet:/, async (ctx) => { await handleApprovalCallback(ctx, ctx.callbackQuery.data ?? "", config.botUsername); });
  bot.callbackQuery("newagent", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("🤖 បើក Mini Web ដើម្បីបង្កើតភ្នាក់ងារថ្មី។", {
      reply_markup: { inline_keyboard: [[{ text: "➕ បង្កើតភ្នាក់ងារ · Add Agent", web_app: { url: `https://t.me/${config.botUsername.replace(/^@/, "")}?startapp=new-agent` } }]] },
    });
  });
  bot.callbackQuery("away_on", async (ctx) => { await ctx.answerCallbackQuery(); await handleAway(ctx); });
  bot.callbackQuery("back", async (ctx) => { await ctx.answerCallbackQuery(); await handleBack(ctx); });
  bot.callbackQuery("rooms", async (ctx) => { await ctx.answerCallbackQuery(); await handleRooms(ctx, config.botUsername); });
  bot.callbackQuery("help", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("ប្រើ /help ដើម្បីមើលបញ្ជីពាក្យបញ្ជា។\nUse /help for the command list."); });
  bot.callbackQuery(/^room:/, async (ctx) => { await handleRoomPick(ctx, ctx.callbackQuery.data.slice(5)); });

  // Group chats: only respond when mentioned or when replying to the bot.
  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") {
      const mentioned = ctx.message.entities?.some((e) => e.type === "mention" && ctx.message?.text?.slice(e.offset, e.offset + e.length).toLowerCase() === `@${config.botUsername.toLowerCase()}`);
      const repliedToBot = ctx.message.reply_to_message?.from?.id === ctx.me.id;
      if (!mentioned && !repliedToBot) return;
    }
    await handleLeadChat(ctx);
  });

  bot.catch((err) => console.error("Bot error", err.error));

  return bot;
}
