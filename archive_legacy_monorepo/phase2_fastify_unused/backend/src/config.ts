import { z } from 'zod';

/** Environment validation — fails fast at boot on bad config. No secrets are logged. */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  ALLOWED_TELEGRAM_IDS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean).map(Number).filter((n) => Number.isFinite(n))),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  LLM_FAST_MODEL: z.string().default('gemini-2.5-flash'),
  LLM_STRONG_MODEL: z.string().default('gemini-2.5-pro'),
  SENTRY_DSN: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default('angkor-eyes-attachments'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITLAB_WEBHOOK_TOKEN: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STOP_ALL: z
    .string()
    .default('false')
    .transform((s) => s.toLowerCase() === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

/** Tunables for the orchestrator (safe defaults, overridable in code/tests). */
export const ORCHESTRATOR = {
  maxTurnsPerTrigger: 6,
  roomLockTtlMs: 120_000,
  runnerLeaseMs: 60_000,
  runnerHeartbeatMs: 15_000,
  retryMaxAttempts: 5,
  retryBaseDelayMs: 1_000,
  approvalTtlHours: 24,
  lowConfidenceThreshold: 0.6,
  maxParallelBranches: 8,
} as const;

export const isProduction = env.NODE_ENV === 'production';
