import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { validateInitData, type TelegramUser } from './auth';
import { isDuplicateTelegramUpdate } from '../services/idempotency';
import { logger } from './logger';

declare module 'fastify' {
  interface FastifyRequest {
    telegramUser?: TelegramUser;
    apiKeyScopes?: string[];
  }
}

/** Require a valid Telegram initData header (x-telegram-init-data). */
export async function requireTelegram(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const initData = req.headers['x-telegram-init-data'] as string | undefined;
  const user = validateInitData(initData);
  if (!user) {
    void reply.code(401).send({ error: 'unauthorized', message: 'invalid or missing Telegram initData' });
    return;
  }
  req.telegramUser = user;
}

/** Optional auth: attach user when initData is valid, continue anonymously otherwise. */
export async function optionalTelegram(req: FastifyRequest): Promise<void> {
  const initData = req.headers['x-telegram-init-data'] as string | undefined;
  const user = validateInitData(initData);
  if (user) req.telegramUser = user;
}

/** Telegram update_id dedupe for webhook ingress (bot forwards updates here). */
export async function dedupeTelegramUpdate(updateId: number): Promise<boolean> {
  return isDuplicateTelegramUpdate(updateId);
}

export function pagination(req: FastifyRequest): { limit: number; offset: number } {
  const q = req.query as Record<string, string | undefined>;
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? '50') || 50));
  const offset = Math.max(0, Number(q.offset ?? '0') || 0);
  return { limit, offset };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _req, reply) => {
    logger.error({ err }, 'request error');
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    void reply.code(status >= 400 && status < 600 ? status : 500).send({
      error: 'internal_error',
      message: status >= 500 ? 'internal error' : (err as Error).message,
    });
  });
}
