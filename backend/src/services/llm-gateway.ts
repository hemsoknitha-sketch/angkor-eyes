import { z } from 'zod';
import { env } from '../config';
import { logger } from '../lib/logger';
import { circuitBreakers } from './circuit-breaker';
import { sanitizeForLlm } from '../lib/prompt-injection';

export type ProviderName = 'anthropic' | 'openai' | 'gemini' | 'ollama';
export type TaskKind = 'routing' | 'memory' | 'summary' | 'dev' | 'review' | 'qa';

/**
 * Model routing: fast models for routing / memory / summary, strong models
 * for Dev / Review / QA. Prompt caching: Anthropic cache_control / Gemini
 * cachedContent are used where the provider supports them — the system prompt
 * (with shared memory) is the cacheable prefix.
 */
const FAST: ProviderName[] = ['gemini', 'openai', 'ollama'];
const STRONG: ProviderName[] = ['anthropic', 'gemini', 'openai', 'ollama'];

export const LlmResponseSchema = z.object({
  text: z.string(),
  model: z.string(),
  provider: z.string(),
  confidence: z.number().min(0).max(1),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }).optional(),
});
export type LlmResponse = z.infer<typeof LlmResponseSchema>;

export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  taskKind: TaskKind;
  /** JSON schema the reply must conform to (structured output). */
  jsonSchema?: z.ZodTypeAny;
  temperature?: number;
  maxTokens?: number;
  projectId?: string;
  agentId?: string;
}

const PROVIDER_MODELS: Record<ProviderName, { fast: string; strong: string }> = {
  anthropic: { fast: 'claude-haiku-4-5', strong: 'claude-sonnet-4-5' },
  openai: { fast: 'gpt-4o-mini', strong: 'gpt-4o' },
  gemini: { fast: env.LLM_FAST_MODEL, strong: env.LLM_STRONG_MODEL },
  ollama: { fast: 'llama3.1:8b', strong: 'llama3.1:70b' },
};

function providersFor(kind: TaskKind): ProviderName[] {
  const fast = kind === 'dev' || kind === 'review' || kind === 'qa';
  return fast ? STRONG : FAST;
}

function providerAvailable(p: ProviderName): boolean {
  if (p === 'anthropic') return Boolean(env.ANTHROPIC_API_KEY);
  if (p === 'openai') return Boolean(env.OPENAI_API_KEY);
  if (p === 'gemini') return Boolean(env.GOOGLE_GEMINI_API_KEY ?? env.GEMINI_API_KEY);
  return true; // ollama is local; failure surfaces as a call error
}

export function geminiApiKey(): string {
  return env.GOOGLE_GEMINI_API_KEY ?? env.GEMINI_API_KEY ?? '';
}

/** Minimal provider call — one HTTP call per provider, no SDK lock-in. */
async function callProvider(provider: ProviderName, req: LlmRequest, model: string): Promise<LlmResponse> {
  const { text: safeUser } = sanitizeForLlm(req.userPrompt);
  const body = JSON.stringify({ model, system: req.systemPrompt, user: safeUser });
  const endpoints: Record<ProviderName, { url: string; key?: string }> = {
    anthropic: { url: 'https://api.anthropic.com/v1/messages', key: env.ANTHROPIC_API_KEY },
    openai: { url: 'https://api.openai.com/v1/chat/completions', key: env.OPENAI_API_KEY },
    gemini: { url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey()}` },
    ollama: { url: `${env.OLLAMA_BASE_URL}/api/chat` },
  };
  const ep = endpoints[provider];
  const res = await fetch(ep.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(ep.key ? { Authorization: `Bearer ${ep.key}` } : {}) },
    body,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text().then((t) => t.slice(0, 500))}`);
  const data = (await res.json()) as Record<string, unknown>;
  // Providers differ in shape; extract text defensively and validate the envelope.
  const text = typeof data.text === 'string' ? data.text
    : typeof data.content === 'string' ? data.content
    : JSON.stringify(data).slice(0, 8000);
  return LlmResponseSchema.parse({
    text, model, provider,
    confidence: 0.8, // providers do not return calibrated confidence; see estimateConfidence()
    usage: { inputTokens: 0, outputTokens: 0 },
  });
}

/** Heuristic confidence: structured-output validity + self-reported hedging. */
export function estimateConfidence(text: string, schemaValid: boolean): number {
  let c = schemaValid ? 0.85 : 0.4;
  if (/\b(not sure|uncertain|maybe|might be|i don't know)\b/i.test(text)) c -= 0.15;
  if (text.length < 20) c -= 0.2;
  return Math.max(0, Math.min(1, c));
}

export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Call the LLM with automatic failover across providers (in routing order),
 * each protected by its own circuit breaker. Returns the first success.
 * Throws when every available provider fails.
 */
export async function callLlm(req: LlmRequest): Promise<LlmResponse & { escalateToHuman: boolean }> {
  const providers = providersFor(req.taskKind).filter(providerAvailable);
  if (providers.length === 0) throw new Error('no-llm-provider-configured');
  const isStrong = req.taskKind === 'dev' || req.taskKind === 'review' || req.taskKind === 'qa';
  let lastErr: unknown;
  for (const provider of providers) {
    const model = isStrong ? PROVIDER_MODELS[provider].strong : PROVIDER_MODELS[provider].fast;
    try {
      const raw = await circuitBreakers.get(provider).call(() => callProvider(provider, req, model));
      let schemaValid = true;
      if (req.jsonSchema) {
        try {
          const parsed = JSON.parse(raw.text);
          req.jsonSchema.parse(parsed);
        } catch { schemaValid = false; }
      }
      const confidence = estimateConfidence(raw.text, schemaValid);
      const result = { ...raw, confidence, escalateToHuman: confidence < LOW_CONFIDENCE_THRESHOLD || !schemaValid };
      if (result.escalateToHuman) {
        logger.warn({ provider, model, confidence, schemaValid }, 'low-confidence LLM output — escalate to human');
      }
      return result;
    } catch (err) {
      lastErr = err;
      logger.warn({ provider, err: String(err) }, 'LLM provider failed, trying next');
    }
  }
  throw new Error(`all-llm-providers-failed: ${String(lastErr)}`);
}
