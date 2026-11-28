import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

/**
 * Validate Telegram WebApp initData (HMAC-SHA256, per Telegram docs).
 * Returns the authenticated user, or null when invalid / expired / not whitelisted.
 * NEVER trust initData without this check — the Mini Web app must send it on every call.
 */
export function validateInitData(initData: string | undefined | null): TelegramUser | null {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    // auth_date freshness: reject initData older than 24h
    const authDate = Number(params.get('auth_date') ?? '0');
    if (!authDate || Date.now() / 1000 - authDate > 86_400) return null;
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = createHash('sha256').update(env.TELEGRAM_BOT_TOKEN).digest();
    const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const user = JSON.parse(params.get('user') ?? '{}') as TelegramUser;
    if (!user.id) return null;
    if (env.ALLOWED_TELEGRAM_IDS.length > 0 && !env.ALLOWED_TELEGRAM_IDS.includes(user.id)) return null;
    return user;
  } catch {
    return null;
  }
}

/** Whitelist check usable by the bot / admin routes. */
export function isAllowedTelegramId(id: number): boolean {
  return env.ALLOWED_TELEGRAM_IDS.length === 0 || env.ALLOWED_TELEGRAM_IDS.includes(id);
}

export function isStopAll(): boolean {
  return env.STOP_ALL;
}
