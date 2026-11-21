import type { Bot } from "grammy";
import type { AppContext } from "./types.js";
import { mainMenuKeyboard, newAgentKeyboard } from "./keyboards.js";
import { handleAway, handleBack } from "./handlers/away.js";
import { handleRooms } from "./handlers/rooms.js";

export const HELP_TEXT =
  "🤖 ANGKOR EYES — ជំនួយ · Help\n\n" +
  "/start — ចាប់ផ្តើម · Start\n" +
  "/newagent — បង្កើតភ្នាក់ងារថ្មី (បើក Mini Web) · Add an agent\n" +
  "/away — បើក Away Mode · Go away\n" +
  "/back — ត្រឡប់មកវិញ + សង្ខេប · Back + digest\n" +
  "/schedule — កាលវិភាគភ្នាក់ងារ · Schedule\n" +
  "/help — ជំនួយនេះ · This help\n\n" +
  "💬 ផ្ញើសារធម្មតា ដើម្បីនិយាយជាមួយ Lead Agent។\n" +
  "💬 Send any message to talk to the Lead Agent.\n\n" +
  "🧵 Telegram Forum Topics: បន្ទប់នីមួយៗអាចភ្ជាប់ទៅ Topic មួយក្នុងក្រុម Forum — មើល README សម្រាប់ការណែនាំ។\n" +
  "Each room can be linked to one Forum Topic in a group — see README.";

export function registerCommands(bot: Bot<AppContext>, botUsername: string) {
  bot.command("start", async (ctx) => {
    const name = ctx.from?.first_name ?? "";
    await ctx.reply(
      `សួស្តី ${name}! 👋 ខ្ញុំជា Lead Agent របស់ ANGKOR EYES។\n` +
        `Hello ${name}! I'm the ANGKOR EYES Lead Agent.\n\n` +
        `ប្រាប់ខ្ញុំពីកិច្ចការ ឬបើក Mini Web ដើម្បីគ្រប់គ្រងភ្នាក់ងារ បន្ទប់ និងការអនុម័ត។`,
      { reply_markup: mainMenuKeyboard(botUsername) },
    );
  });

  bot.command("help", async (ctx) => { await ctx.reply(HELP_TEXT); });

  // /newagent opens the Mini Web to add an agent (no-code form).
  bot.command("newagent", async (ctx) => {
    await ctx.reply("🤖 បង្កើតភ្នាក់ងារថ្មីក្នុង Mini Web — បំពេញឈ្មោះ គម្រោង តួនាទី និង Model។\n🤖 Add a new agent in the Mini Web app — name, project, role and model.", {
      reply_markup: newAgentKeyboard(botUsername),
    });
  });

  bot.command("away", handleAway);
  bot.command("back", handleBack);

  bot.command("schedule", async (ctx) => {
    await ctx.reply(
      "📅 កាលវិភាគ៖ បើក Mini Web → System Control Center ដើម្បីកំណត់ពេលវេលាដំណើរការភ្នាក់ងារ។\n" +
        "📅 Scheduling: open the Mini Web app → System Control Center to schedule agent runs.",
      { reply_markup: mainMenuKeyboard(botUsername) },
    );
  });

  bot.command("rooms", async (ctx) => { await handleRooms(ctx, botUsername); });
}
