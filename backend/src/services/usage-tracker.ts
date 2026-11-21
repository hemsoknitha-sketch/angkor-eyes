import { query } from '../lib/db';
import { logger } from '../lib/logger';

/** Usage / cost tracking per agent / day / project + budget limits. */
export interface UsageRecord {
  agentId?: string | null;
  projectId?: string | null;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// Rough per-1k-token prices (USD) — update from provider pricing pages; used for budgeting, not billing.
const PRICE_PER_1K: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5': { input: 0.001, output: 0.005 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
  'gemini-2.0-pro': { input: 0.00125, output: 0.005 },
  default: { input: 0.001, output: 0.003 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICE_PER_1K[model] ?? PRICE_PER_1K.default;
  return (inputTokens / 1000) * p.input + (outputTokens / 1000) * p.output;
}

export async function recordUsage(r: UsageRecord): Promise<void> {
  const cost = r.costUsd || estimateCost(r.model, r.inputTokens, r.outputTokens);
  await query(
    `INSERT INTO usage_logs (agent_id, project_id, model, provider, input_tokens, output_tokens, cost_usd)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [r.agentId ?? null, r.projectId ?? null, r.model, r.provider, r.inputTokens, r.outputTokens, cost],
  );
}

export async function dailyUsage(projectId: string, date = new Date()): Promise<{ totalCostUsd: number; totalTokens: number; byAgent: Array<{ agentId: string | null; costUsd: number }> }> {
  const day = date.toISOString().slice(0, 10);
  const total = await query<{ cost: string; tokens: string }>(
    `SELECT COALESCE(SUM(cost_usd),0) AS cost, COALESCE(SUM(input_tokens+output_tokens),0) AS tokens
     FROM usage_logs WHERE project_id=$1 AND DATE(created_at)=$2`,
    [projectId, day],
  );
  const byAgent = await query<{ agentId: string | null; costUsd: string }>(
    `SELECT agent_id AS "agentId", SUM(cost_usd) AS "costUsd" FROM usage_logs
     WHERE project_id=$1 AND DATE(created_at)=$2 GROUP BY agent_id ORDER BY 2 DESC`,
    [projectId, day],
  );
  return {
    totalCostUsd: Number(total.rows[0]?.cost ?? 0),
    totalTokens: Number(total.rows[0]?.tokens ?? 0),
    byAgent: byAgent.rows.map((r) => ({ agentId: r.agentId, costUsd: Number(r.costUsd) })),
  };
}

/** Budget check: project daily budget (USD) stored in projects.metadata.daily_budget_usd. */
export async function checkBudget(projectId: string): Promise<{ overBudget: boolean; spentUsd: number; budgetUsd: number | null }> {
  const proj = await query<{ metadata: { daily_budget_usd?: number } }>(
    `SELECT metadata FROM projects WHERE id=$1`, [projectId],
  );
  const budget = proj.rows[0]?.metadata?.daily_budget_usd ?? null;
  const usage = await dailyUsage(projectId);
  const overBudget = budget !== null && usage.totalCostUsd >= budget;
  if (overBudget) logger.warn({ projectId, spentUsd: usage.totalCostUsd, budgetUsd: budget }, 'project daily budget exceeded');
  return { overBudget, spentUsd: usage.totalCostUsd, budgetUsd: budget };
}
