import { webhookCallback } from "grammy";
import { createBot } from "./bot.js";
import { loadConfig, isWebhookMode } from "./config.js";

const config = loadConfig();
const bot = createBot(config);

async function main() {
  if (isWebhookMode(config)) {
    // Webhook mode: WEBHOOK_DOMAIN=https://your-domain.example
    const { createServer } = await import("node:http");
    const handle = webhookCallback(bot, "http", { secretToken: config.webhookSecret });
    const server = createServer(async (req, res) => {
      if (req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
      if (req.method === "POST" && req.url === "/telegram/webhook") { await handle(req, res); return; }
      res.writeHead(404); res.end("not found");
    });
    server.listen(config.port, async () => {
      await bot.api.setWebhook(`${config.webhookDomain}/telegram/webhook`, { secret_token: config.webhookSecret }).catch((e) => console.error("setWebhook failed", e));
      console.log(`ANGKOR EYES bot webhook listening on :${config.port}`);
    });
    const shutdown = async () => { server.close(); await bot.stop(); process.exit(0); };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } else {
    // Polling mode (local dev): BOT_TOKEN only.
    await bot.start({
      onStart: (info) => console.log(`ANGKOR EYES bot polling as @${info.username} (backend: ${config.backendUrl})`),
    });
    const shutdown = async () => { await bot.stop(); process.exit(0); };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
