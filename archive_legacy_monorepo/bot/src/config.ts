/** ANGKOR EYES bot config — env only, no hardcoded secrets/URLs. */
export interface BotConfig {
  token: string;
  backendUrl: string;
  botUsername: string;
  allowedIds: Set<number>;
  webhookDomain?: string;
  webhookSecret?: string;
  port: number;
  nodeEnv: string;
}

function parseIds(raw: string | undefined): Set<number> {
  if (!raw) return new Set();
  return new Set(raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0));
}

export function loadConfig(): BotConfig {
  const token = process.env.BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!token) throw new Error("Missing BOT_TOKEN (or TELEGRAM_BOT_TOKEN) env var.");
  return {
    token,
    backendUrl: (process.env.BACKEND_URL ?? "http://localhost:3000").replace(/\/$/, ""),
    botUsername: process.env.BOT_USERNAME ?? "",
    allowedIds: parseIds(process.env.ALLOWED_TELEGRAM_IDS),
    webhookDomain: process.env.WEBHOOK_DOMAIN || undefined,
    webhookSecret: process.env.WEBHOOK_SECRET_TOKEN || undefined,
    port: Number(process.env.PORT ?? 8080),
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}

export const isWebhookMode = (c: BotConfig) => Boolean(c.webhookDomain);
