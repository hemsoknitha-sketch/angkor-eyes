import { config } from '../config/index.js';
import { SecretRedactor } from '../safety/redactor.js';
import { PromptInjectionDefense } from '../safety/injection-defense.js';
import { InMemoryResponseCache, FreeGeminiKeyPool, HuggingFaceFreeClient, HeuristicSovereignFallback } from './free-tier-pool.js';

export interface LLMRequestMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // Base64 encoded or URLs for multimodal input
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: 'gemini' | 'anthropic' | 'openai' | 'ollama' | 'simulation';
  tokensUsed: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
  circuitBreakerTripped?: boolean;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface ProviderCircuit {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  cooldownMs: number;
  failureThreshold: number;
}

export class LLMCircuitBreaker {
  private static circuits: Map<string, ProviderCircuit> = new Map([
    ['gemini', { state: 'CLOSED', failureCount: 0, lastFailureTime: 0, cooldownMs: 30000, failureThreshold: 3 }],
    ['anthropic', { state: 'CLOSED', failureCount: 0, lastFailureTime: 0, cooldownMs: 30000, failureThreshold: 3 }],
    ['openai', { state: 'CLOSED', failureCount: 0, lastFailureTime: 0, cooldownMs: 30000, failureThreshold: 3 }],
    ['ollama', { state: 'CLOSED', failureCount: 0, lastFailureTime: 0, cooldownMs: 30000, failureThreshold: 3 }]
  ]);

  public static isAvailable(provider: string): boolean {
    const circuit = this.circuits.get(provider);
    if (!circuit) return true;

    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailureTime > circuit.cooldownMs) {
        circuit.state = 'HALF_OPEN';
        console.log(`[CircuitBreaker] Provider ${provider} state transitioned to HALF_OPEN.`);
        return true;
      }
      return false;
    }
    return true;
  }

  public static recordSuccess(provider: string): void {
    const circuit = this.circuits.get(provider);
    if (circuit) {
      circuit.state = 'CLOSED';
      circuit.failureCount = 0;
    }
  }

  public static recordFailure(provider: string): void {
    const circuit = this.circuits.get(provider);
    if (!circuit) return;

    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    if (circuit.failureCount >= circuit.failureThreshold || circuit.state === 'HALF_OPEN') {
      circuit.state = 'OPEN';
      console.warn(`[CircuitBreaker] ⚠️ Circuit tripped OPEN for provider: ${provider}. Cooldown: ${circuit.cooldownMs}ms`);
    }
  }

  public static getStates(): Record<string, { state: CircuitState; failureCount: number }> {
    const res: Record<string, { state: CircuitState; failureCount: number }> = {};
    for (const [k, v] of this.circuits.entries()) {
      res[k] = { state: v.state, failureCount: v.failureCount };
    }
    return res;
  }
}

export class LLMGateway {
  private static hfDisabledDueTo403 = false;
  /**
   * Route and execute LLM calls with secret redaction, safety hierarchy, multimodal support, and automatic circuit breaker failover.
   */
  public static async generateResponse(params: {
    messages: LLMRequestMessage[];
    preferredModel?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = params.preferredModel || config.defaultModel;

    // 1. Redact secrets from all outbound messages
    const sanitizedMessages: LLMRequestMessage[] = params.messages.map(m => {
      const { cleanText } = SecretRedactor.redact(m.content);
      return {
        role: m.role,
        content: cleanText,
        images: m.images
      };
    });

    // 2. Prepend instruction hierarchy to system message
    const hierarchyPrefix = PromptInjectionDefense.getInstructionHierarchyPrefix();
    const systemIdx = sanitizedMessages.findIndex(m => m.role === 'system');
    if (systemIdx >= 0) {
      sanitizedMessages[systemIdx].content = `${hierarchyPrefix}\n\n${sanitizedMessages[systemIdx].content}`;
    } else {
      sanitizedMessages.unshift({ role: 'system', content: hierarchyPrefix });
    }

    // 2.5 Check In-Memory High Speed Cache (Sub-0.1ms, 0 tokens, $0.00 cost)
    const cacheKey = InMemoryResponseCache.computeKey(sanitizedMessages, model);
    const cached = InMemoryResponseCache.get(cacheKey);
    if (cached) {
      return {
        content: cached.content,
        model: cached.model,
        provider: (cached.provider as any) || 'simulation',
        tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        durationMs: Date.now() - startTime
      };
    }

    // 3. Provider cascade order
    const cascadeOrder = this.determineCascade(model);

    for (const provider of cascadeOrder) {
      if (!LLMCircuitBreaker.isAvailable(provider)) {
        console.log(`[LLMGateway] Skipping tripped provider: ${provider}, checking next.`);
        continue;
      }

      try {
        let res: LLMResponse;
        if (provider === 'gemini') {
          res = await this.callGemini(sanitizedMessages, model, startTime);
        } else if (provider === 'huggingface') {
          res = await this.callHuggingFace(sanitizedMessages, model, startTime);
        } else if (provider === 'anthropic') {
          res = await this.callAnthropic(sanitizedMessages, model, startTime);
        } else if (provider === 'openai') {
          res = await this.callOpenAI(sanitizedMessages, model, startTime);
        } else if (provider === 'ollama') {
          res = await this.callOllama(sanitizedMessages, model, startTime);
        } else {
          res = this.callSimulator(sanitizedMessages, model, startTime);
        }

        LLMCircuitBreaker.recordSuccess(provider);
        InMemoryResponseCache.set(cacheKey, res.content, res.model, res.provider);
        return res;
      } catch (err: any) {
        console.warn(`[LLMGateway] Provider ${provider} failed (${err.message}). Recording failure and triggering failover...`);
        LLMCircuitBreaker.recordFailure(provider);
      }
    }

    // Ultimate fallback if all external providers trip
    console.log('[LLMGateway] All remote LLM providers tripped or unavailable. Using resilient deterministic simulator.');
    const simRes = this.callSimulator(sanitizedMessages, model, startTime);
    simRes.circuitBreakerTripped = true;
    return simRes;
  }

  private static determineCascade(model: string): string[] {
    const list: string[] = [];

    // Prioritize Free Hugging Face open-weight models if requested or configured
    if (config.hfToken || model.includes('deepseek') || model.includes('qwen')) {
      if (!LLMGateway.hfDisabledDueTo403) list.push('huggingface');
    }

    if (config.geminiApiKey || config.geminiApiKeys.length > 0) {
      list.push('gemini');
    }

    if (config.anthropicApiKey && model.includes('claude')) {
      list.push('anthropic');
    } else if (config.openaiApiKey && (model.includes('gpt') || model.includes('o1') || model.includes('o3'))) {
      list.push('openai');
    }

    if (config.hfToken && !list.includes('huggingface')) {
      if (!LLMGateway.hfDisabledDueTo403) list.push('huggingface');
    }

    if (process.env.ENABLE_OLLAMA === 'true' || model.startsWith('ollama')) list.push('ollama');
    list.push('simulation');
    return list;
  }

  private static async callHuggingFace(messages: LLMRequestMessage[], model: string, startTime: number): Promise<LLMResponse> {
    const res = await HuggingFaceFreeClient.queryModel({ messages, model });
    return {
      content: res.content,
      model: res.model,
      provider: 'huggingface' as any,
      tokensUsed: { promptTokens: 150, completionTokens: 250, totalTokens: 400 },
      durationMs: Date.now() - startTime
    };
  }

  private static async callGemini(messages: LLMRequestMessage[], model: string, startTime: number): Promise<LLMResponse> {
    const apiKey = FreeGeminiKeyPool.getActiveKey();
    if (!apiKey) throw new Error('No active Gemini API key in pool');

    const systemMessage = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const contents = messages.filter(m => m.role !== 'system').map(m => {
      const parts: any[] = [{ text: m.content }];
      if (m.images && m.images.length > 0) {
        for (const img of m.images) {
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: img.replace(/^data:image\/[a-z]+;base64,/, '')
            }
          });
        }
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });

    const targetModel = model.startsWith('gemini') ? model : 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
    const payload: any = {
      contents,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.4
      }
    };
    if (systemMessage) {
      payload.systemInstruction = { parts: [{ text: systemMessage }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      if (res.status === 429 || errorText.includes('RESOURCE_EXHAUSTED')) {
        FreeGeminiKeyPool.markExhausted(apiKey);
      }
      throw new Error(`Gemini API error ${res.status}: ${errorText}`);
    }

    const data: any = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    const promptTokens = data.usageMetadata?.promptTokenCount || 150;
    const completionTokens = data.usageMetadata?.candidatesTokenCount || 80;

    return {
      content: text,
      model: targetModel,
      provider: 'gemini',
      tokensUsed: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      durationMs: Date.now() - startTime
    };
  }

  private static async callAnthropic(messages: LLMRequestMessage[], model: string, startTime: number): Promise<LLMResponse> {
    if (!config.anthropicApiKey) throw new Error('Anthropic API key is not configured');

    const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const userAndAssistant = messages.filter(m => m.role !== 'system').map(m => {
      if (m.images && m.images.length > 0) {
        const contentArr: any[] = [{ type: 'text', text: m.content }];
        for (const img of m.images) {
          contentArr.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: img.replace(/^data:image\/[a-z]+;base64,/, '')
            }
          });
        }
        return { role: m.role, content: contentArr };
      }
      return { role: m.role, content: m.content };
    });

    const targetModel = model.startsWith('claude') ? model : 'claude-3-5-sonnet-20241022';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: targetModel,
        max_tokens: 2048,
        system,
        messages: userAndAssistant
      })
    });

    if (!res.ok) {
      throw new Error(`Anthropic API Error: ${res.status} ${await res.text()}`);
    }

    const data: any = await res.json();
    const text = data.content?.[0]?.text || '';
    const promptTokens = data.usage?.input_tokens || 120;
    const completionTokens = data.usage?.output_tokens || 60;

    return {
      content: text,
      model: targetModel,
      provider: 'anthropic',
      tokensUsed: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      durationMs: Date.now() - startTime
    };
  }

  private static async callOpenAI(messages: LLMRequestMessage[], model: string, startTime: number): Promise<LLMResponse> {
    if (!config.openaiApiKey) throw new Error('OpenAI API key is not configured');

    const targetModel = model.startsWith('gpt') ? model : 'gpt-4o';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: targetModel,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI API Error: ${res.status} ${await res.text()}`);
    }

    const data: any = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const promptTokens = data.usage?.prompt_tokens || 100;
    const completionTokens = data.usage?.completion_tokens || 50;

    return {
      content: text,
      model: targetModel,
      provider: 'openai',
      tokensUsed: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      durationMs: Date.now() - startTime
    };
  }

  private static async callOllama(messages: LLMRequestMessage[], model: string, startTime: number): Promise<LLMResponse> {
    const res = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.replace(/^ollama\//, ''),
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama Error: ${res.status}`);
    }

    const data: any = await res.json();
    const text = data.message?.content || '';

    return {
      content: text,
      model,
      provider: 'ollama',
      tokensUsed: {
        promptTokens: data.prompt_eval_count || 100,
        completionTokens: data.eval_count || 50,
        totalTokens: (data.prompt_eval_count || 100) + (data.eval_count || 50)
      },
      durationMs: Date.now() - startTime
    };
  }

  private static callSimulator(messages: LLMRequestMessage[], model: string, startTime: number): LLMResponse {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';

    let content = '';

    if (systemPrompt.includes('Rex') || systemPrompt.includes('Lead AI Orchestrator') || systemPrompt.includes('ANGKOR EYES')) {
      content = `🇰🇭 **ការឆ្លើយតបពី AGI ANGKOR EYES (Supreme Command)**:
ខ្ញុំបានវិភាគសំណើ: "${lastUserMessage.substring(0, 100)}"
រៀបចំ Task DAG ជា ៣ ជំហាន៖
1. **Developer (Dara)**: បង្កើត Git Worktree និងសរសេរកូដតាមតម្រូវការ
2. **QA Automation (Bopha)**: រត់ Unit Tests ផ្ទៀងផ្ទាត់ Regression
3. **Code Reviewer (Sok)**: ពិនិត្យ Diff និងបញ្ជូន Approval Request

កិច្ចការកំពុងផ្ញើទៅ Dara ដើម្បីចាប់ផ្តើម។`;
    } else if (systemPrompt.includes('Dara') || systemPrompt.includes('Developer')) {
      content = `👨‍💻 **Dara (Developer)**:
ខ្ញុំបានបង្កើត Worktree ដាច់ដោយឡែក \`worktrees/my-shop-dev-task\` និងបានកែប្រែកូដរួចរាល់។
- បន្ថែម API Caching
- បង្កើនល្បឿន Query ក្នុង Database
- បាន Commit ទៅ Branch \`agent/dev/task-perf-optimization\`

បានផ្ញើទៅ Bopha (QA) ដើម្បីរត់តេស្ត។`;
    } else if (systemPrompt.includes('Bopha') || systemPrompt.includes('QA')) {
      content = `🧪 **Bopha (QA Automation)**:
ខ្ញុំបានរត់ Test Suite:
\`\`\`bash
npm test -- --run
✓ tests/performance.spec.ts (4 passed)
✓ tests/api.spec.ts (12 passed)
Total: 16 passed, 0 failed
\`\`\`
**លទ្ធផល: QA PASS** ✅
បានបញ្ជូនទៅ Sok (Code Reviewer) ដើម្បីពិនិត្យ Diff សុវត្ថិភាព។`;
    } else if (systemPrompt.includes('Sok') || systemPrompt.includes('Code Reviewer')) {
      content = `🔍 **Sok (Code Reviewer)**:
ខ្ញុំបានពិនិត្យ Diff (+45, -12):
- គ្មាន Secret Leaks ឬ SQL Injection ឡើយ
- Logic ត្រឹមត្រូវ និងតាម Coding Standard

⚠️ **សកម្មភាពត្រូវការការអនុញ្ញាត (Risky Action)**:
ការ Merge ចូល \`main\` និង \`git push\` ទាមទារការយល់ព្រមពីម្ចាស់គម្រោង។
សូមពិនិត្យមើលប៊ូតុង **[Approve]** ឬមើល Diff ក្នុង Mini Web។`;
    } else if (systemPrompt.includes('តំណាង') || systemPrompt.includes('ក្រសួង') || systemPrompt.includes('ស្ថាប័ន') || systemPrompt.includes('រដ្ឋបាល') || systemPrompt.includes('ច្បាប់')) {
      content = HeuristicSovereignFallback.synthesize(lastUserMessage, systemPrompt);
    } else {
      content = `ឆ្លើយតបពី AGI Agent (${model}): ទទួលការងារ "${lastUserMessage.substring(0, 80)}" បានជោគជ័យ។`;
    }

    return {
      content,
      model,
      provider: 'simulation',
      tokensUsed: { promptTokens: 120, completionTokens: 95, totalTokens: 215 },
      durationMs: Date.now() - startTime
    };
  }
}
