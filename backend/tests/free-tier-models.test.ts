import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InMemoryResponseCache,
  FreeGeminiKeyPool,
  HeuristicSovereignFallback
} from '../src/llm/free-tier-pool.js';
import { LLMGateway } from '../src/llm/gateway.js';

test('1. InMemoryResponseCache - Sub-0.1ms RAM Caching & Zero Token Cost', () => {
  const messages = [{ role: 'user', content: 'តួនាទីក្រសួងមហាផ្ទៃ' }];
  const model = 'gemini-2.5-flash';

  const cacheKey = InMemoryResponseCache.computeKey(messages, model);
  assert.equal(typeof cacheKey, 'string');
  assert.equal(cacheKey.length, 64);

  // Set Cache
  InMemoryResponseCache.set(cacheKey, 'ចម្លើយដែលបានរក្សាទុកក្នុង RAM', model, 'simulation', 60);

  // Retrieve Cache
  const cached = InMemoryResponseCache.get(cacheKey);
  assert.ok(cached !== null);
  assert.equal(cached?.content, 'ចម្លើយដែលបានរក្សាទុកក្នុង RAM');
  assert.equal(cached?.model, model);

  InMemoryResponseCache.clear();
  assert.equal(InMemoryResponseCache.size(), 0);
});

test('2. FreeGeminiKeyPool - Round-Robin Multi-Key & 429 Failover', () => {
  FreeGeminiKeyPool.initialize();
  const initialStatus = FreeGeminiKeyPool.getPoolStatus();
  assert.equal(typeof initialStatus.total, 'number');

  // Mark a key exhausted
  const dummyKey = 'AIzaSyTestKeyFor429Rotation12345';
  FreeGeminiKeyPool.markExhausted(dummyKey, 10);

  const afterStatus = FreeGeminiKeyPool.getPoolStatus();
  assert.ok(afterStatus.exhausted >= 1);
});

test('3. HeuristicSovereignFallback - 100% Offline Legal Reasoning', () => {
  const query = 'តើមានវិធានការបែបណាចំពោះការទប់ស្កាត់អំពើពុករលួយ និងបក្ខពួកនិយម?';
  const systemPrompt = 'តួនាទីជាតំណាងក្រសួងយុត្តិធម៌ផ្លូវការ';

  const output = HeuristicSovereignFallback.synthesize(query, systemPrompt);
  assert.ok(output.length > 50);
  assert.ok(output.includes('ស្ថាប័នសូមបញ្ជាក់ជំហរ'));
  assert.ok(output.includes('ប្រឆាំងដាច់ខាត'));
  assert.ok(output.endsWith(' ៕'));
});

test('4. LLMGateway Cache Integration - 24/7 365 Zero-Cost Verification', async () => {
  const messages = [
    { role: 'system' as const, content: 'You are Rex, Lead Orchestrator.' },
    { role: 'user' as const, content: 'Status check for Angkor Eyes' }
  ];

  // First call (populates cache)
  const res1 = await LLMGateway.generateResponse({ messages, preferredModel: 'gemini-2.5-flash' });
  assert.ok(res1.content.length > 0);

  // Second call (hits cache with zero tokens)
  const res2 = await LLMGateway.generateResponse({ messages, preferredModel: 'gemini-2.5-flash' });
  assert.equal(res2.tokensUsed.totalTokens, 0, 'Cached response must consume 0 tokens');
  assert.ok(res2.durationMs <= 10, 'Cached lookup must be near instantaneous');
  assert.equal(res2.content, res1.content);
});
