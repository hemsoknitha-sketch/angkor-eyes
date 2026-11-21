/** Secret redaction — applied to logs, audit records and LLM payloads before storage. */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-ant-[A-Za-z0-9\-_]{8,}/g, '[REDACTED_ANTHROPIC_KEY]'],
  [/sk-[A-Za-z0-9]{20,}/g, '[REDACTED_OPENAI_KEY]'],
  [/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_GOOGLE_KEY]'],
  [/ghp_[A-Za-z0-9]{20,}/g, '[REDACTED_GITHUB_TOKEN]'],
  [/xox[baprs]-[A-Za-z0-9\-]{10,}/g, '[REDACTED_SLACK_TOKEN]'],
  [/\b\d{3,4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[REDACTED_CARD]'],
  [/(Bearer\s+)[A-Za-z0-9\-._~+/=]{10,}/gi, '$1[REDACTED]'],
  [/(api[_-]?key|token|password|secret|passwd)\s*[:=]\s*['"]?[^'"\s,}]{6,}/gi, '$1=[REDACTED]'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]'],
];

export function redactSecretsText(text: string): string {
  let out = text;
  for (const [re, replacement] of SECRET_PATTERNS) out = out.replace(re, replacement);
  return out;
}

const SENSITIVE_KEYS = new Set([
  'token', 'apiKey', 'api_key', 'apikey', 'password', 'passwd', 'secret',
  'access_token', 'refresh_token', 'authorization', 'bot_token', 'webhook_secret',
  'client_secret', 'private_key', 's3_secret_access_key', 'stripe_secret',
]);

export function redactSecrets<T>(value: T): T {
  if (typeof value === 'string') return redactSecretsText(value) as T;
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redactSecrets(v);
    }
    return out as T;
  }
  return value;
}

/** SHA-256 hash for API keys / action hashes — store the hash, never the raw value. */
import { createHash } from 'node:crypto';
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
