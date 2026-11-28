import fs from 'node:fs';
import path from 'node:path';

// Load .env from workspace root or current directory if present
function loadEnvFile(envPath: string) {
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!(key in process.env)) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {}
}

loadEnvFile(path.resolve(process.cwd(), '../.env'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

export interface AppConfig {
  port: number;
  host: string;
  telegramBotToken: string;
  allowedTelegramIds: number[];
  jwtSecret: string;
  databaseUrl: string;
  redisUrl: string;
  runnerToken: string;
  geminiApiKey: string;
  geminiApiKeys: string[];
  hfToken: string;
  hfModel: string;
  cacheTtlSeconds: number;
  anthropicApiKey: string;
  openaiApiKey: string;
  ollamaBaseUrl: string;
  defaultModel: string;
  leadModel: string;
  devModel: string;
  maxTurnsPerTrigger: number;
  autoApprovalMode: boolean;
  dataPath: string;
}

const parseAllowedIds = (raw: string | undefined): number[] => {
  if (!raw) return [];
  return raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
};

const parseStringList = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(s => s.length > 5);
};

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  allowedTelegramIds: parseAllowedIds(process.env.ALLOWED_TELEGRAM_IDS),
  jwtSecret: process.env.JWT_SECRET || 'angkor-eyes-super-secret-jwt-key-2026',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  runnerToken: process.env.RUNNER_TOKEN || 'angkor-runner-token-secure-key',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiApiKeys: parseStringList(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY),
  hfToken: process.env.HF_TOKEN || '',
  hfModel: process.env.HF_MODEL || 'deepseek-ai/DeepSeek-R1',
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '900', 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  defaultModel: process.env.DEFAULT_MODEL || 'gemini-2.5-flash',
  leadModel: process.env.LEAD_MODEL || 'gemini-2.5-flash',
  devModel: process.env.DEV_MODEL || 'gemini-2.5-pro',
  maxTurnsPerTrigger: parseInt(process.env.MAX_TURNS_PER_TRIGGER || '6', 10),
  autoApprovalMode: process.env.AUTO_APPROVAL_MODE === 'true',
  dataPath: path.resolve(process.cwd(), process.env.DATA_PATH || (process.env.NODE_ENV === 'test' ? './data/test_runtime' : './data')),
};
