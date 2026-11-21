import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { khmerLegalEngine } from '../cambodia/legal-engine.js';
import { KhmerLanguageAuditor } from '../cambodia/khmer-auditor.js';

export interface CachedResponse {
  content: string;
  model: string;
  provider: string;
  expiresAt: number;
}

export class InMemoryResponseCache {
  private static cache: Map<string, CachedResponse> = new Map();
  private static defaultTtlSeconds = config.cacheTtlSeconds || 900; // 15 mins default

  public static computeKey(messages: Array<{ role: string; content: string }>, model: string): string {
    const raw = messages.map(m => `${m.role}:${m.content}`).join('|') + `|model:${model}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  public static get(key: string): CachedResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  public static set(key: string, content: string, model: string, provider: string, ttlSeconds?: number): void {
    const ttl = (ttlSeconds || this.defaultTtlSeconds) * 1000;
    this.cache.set(key, {
      content,
      model,
      provider,
      expiresAt: Date.now() + ttl
    });
  }

  public static size(): number {
    return this.cache.size;
  }

  public static clear(): void {
    this.cache.clear();
  }
}

export class FreeGeminiKeyPool {
  private static keys: string[] = [];
  private static exhaustedKeys: Map<string, number> = new Map(); // key -> cooldown until timestamp
  private static currentIndex = 0;

  public static initialize(): void {
    this.keys = [...config.geminiApiKeys];
    if (config.geminiApiKey && !this.keys.includes(config.geminiApiKey)) {
      this.keys.unshift(config.geminiApiKey);
    }
  }

  public static getActiveKey(): string | null {
    if (this.keys.length === 0) this.initialize();
    if (this.keys.length === 0) return null;

    const now = Date.now();
    // Clean up expired exhausted keys
    for (const [key, cooldownUntil] of this.exhaustedKeys.entries()) {
      if (now > cooldownUntil) {
        this.exhaustedKeys.delete(key);
      }
    }

    const available = this.keys.filter(k => !this.exhaustedKeys.has(k));
    if (available.length === 0) {
      console.warn('⚠️ [FreeGeminiKeyPool] All keys temporarily rate-limited. Resetting pool for urgent retry.');
      this.exhaustedKeys.clear();
      return this.keys[0];
    }

    const key = available[this.currentIndex % available.length];
    this.currentIndex = (this.currentIndex + 1) % available.length;
    return key;
  }

  public static markExhausted(key: string, cooldownSec = 3600): void {
    const cooldownUntil = Date.now() + cooldownSec * 1000;
    this.exhaustedKeys.set(key, cooldownUntil);
    console.warn(`🚨 [FreeGeminiKeyPool] Key [${key.slice(0, 8)}...] marked EXHAUSTED (429 Rate Limit) for ${cooldownSec}s. Remaining available: ${this.keys.length - this.exhaustedKeys.size}/${this.keys.length}`);
  }

  public static getPoolStatus(): { total: number; available: number; exhausted: number } {
    if (this.keys.length === 0) this.initialize();
    return {
      total: this.keys.length,
      available: Math.max(0, this.keys.length - this.exhaustedKeys.size),
      exhausted: this.exhaustedKeys.size
    };
  }
}

export class HuggingFaceFreeClient {
  public static async queryModel(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
  }): Promise<{ content: string; model: string }> {
    const model = params.model || config.hfModel || 'deepseek-ai/DeepSeek-R1';
    const token = config.hfToken;
    const url = `https://router.huggingface.co/hf-inference/models/${model}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const promptText = params.messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: promptText,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.3,
          return_full_text: false
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HF Free Inference error ${res.status}: ${errText}`);
    }

    const data: any = await res.json();
    let output = '';
    if (Array.isArray(data) && data[0]?.generated_text) {
      output = data[0].generated_text;
    } else if (typeof data === 'string') {
      output = data;
    } else {
      output = JSON.stringify(data);
    }

    return { content: output.trim(), model };
  }
}

export class HeuristicSovereignFallback {
  /**
   * 100% Free, Zero-Network, Zero-Token Heuristic Sovereign Synthesizer.
   * Produces compliant Cambodian institutional answers using local legal corpus.
   */
  public static synthesize(userQuery: string, systemPrompt?: string): string {
    const relevantLaws = khmerLegalEngine.searchRelevantLaws(userQuery, 3);
    const lawsText = relevantLaws.length > 0
      ? khmerLegalEngine.formatLegalCitations(relevantLaws)
      : 'ផ្អែកលើមាត្រា ៥១ នៃរដ្ឋធម្មនុញ្ញ (លទ្ធិប្រជាធិបតេយ្យសេរីពហុបក្ស និងនីតិរដ្ឋ) និងច្បាប់ស្តីពីការប្រឆាំងអំពើពុករលួយ។';

    const rawResponse = `
ផ្អែកលើការត្រួតពិនិត្យយ៉ាងហ្មត់ចត់ចំពោះសំណើ/បញ្ហានេះ ស្ថាប័នសូមបញ្ជាក់ជំហរ និងដំណោះស្រាយផ្លូវការដូចខាងក្រោម ៖

១. វិធានការចំពោះមុខ និងនីតិវិធីដោះស្រាយ ៖ 
រាល់សំណូមពរ និងបញ្ហាត្រូវបានពិនិត្យផ្ទៀងផ្ទាត់ដោយតម្លាភាព គណនេយ្យភាព និងគ្មានការរើសអើង ដើម្បីធានាបាននូវយុត្តិធម៌សង្គម និងការអភិវឌ្ឍជាតិប្រកបដោយចីរភាព។

២. មូលដ្ឋានច្បាប់យោង ៖
${lawsText}

៣. ការប្តេជ្ញាចិត្តស្ថាប័ន ៖
ស្ថាប័នប្រឆាំងដាច់ខាតរាល់ទម្រង់នៃអំពើពុករលួយ និងបក្ខពួកនិយម ព្រមទាំងប្តេជ្ញាបម្រើសេវាសាធារណៈជូនប្រជាពលរដ្ឋគ្រប់រូបដោយស្មើភាពនៅចំពោះមុខច្បាប់ ៕
`.trim();

    const { cleanText } = KhmerLanguageAuditor.auditAndPurify(rawResponse);
    return cleanText;
  }
}
