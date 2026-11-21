import pino from 'pino';
import { env } from '../config';
import { redactSecrets } from './secrets-redaction';

/** Structured JSON logger. Secrets are redacted before any line is written. */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-telegram-init-data"]',
      '*.token',
      '*.apiKey',
      '*.api_key',
      '*.password',
      '*.secret',
      'TELEGRAM_BOT_TOKEN',
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'GOOGLE_GEMINI_API_KEY',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    log(obj: Record<string, unknown>) {
      return redactSecrets(obj) as Record<string, unknown>;
    },
  },
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
