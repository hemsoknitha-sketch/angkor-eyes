import { z } from 'zod';
import { query } from '../lib/db';
import { logger } from '../lib/logger';
import { redactSecretsText } from '../lib/secrets-redaction';

/**
 * Evaluation harness (offline + online).
 * - Stores eval runs (dataset, model, scores) in audit_logs / a dedicated
 *   eval table via metadata; the runner executes the cases.
 * - Online: every 👍/👎 feedback row feeds the eval aggregate.
 * This module is the bookkeeping + scoring side; running model evals is
 * the runner's job (see tests/ in the repo root, owned by other agents).
 */
export const EvalCaseSchema = z.object({
  id: z.string(),
  input: z.string(),
  expected: z.string().optional(),
  rubric: z.array(z.string()).default([]),
});
export type EvalCase = z.infer<typeof EvalCaseSchema>;

export interface EvalResult {
  caseId: string;
  passed: boolean;
  score: number; // 0..1
  notes: string;
}

export function scoreEvalCase(result: { output: string; expected?: string; rubric: string[] }): EvalResult {
  const output = result.output.toLowerCase();
  let score = 0.5;
  if (result.expected && output.includes(result.expected.toLowerCase())) score += 0.4;
  if (result.rubric.length > 0) {
    const hits = result.rubric.filter((r) => output.includes(r.toLowerCase())).length;
    score = Math.max(score, hits / result.rubric.length);
  }
  return { caseId: '', passed: score >= 0.7, score: Math.min(1, score), notes: redactSecretsText(result.output.slice(0, 500)) };
}

export async function recordEvalRun(name: string, model: string, results: EvalResult[]): Promise<{ runId: string; passRate: number }> {
  const passRate = results.length === 0 ? 0 : results.filter((r) => r.passed).length / results.length;
  const res = await query<{ id: string }>(
    `INSERT INTO audit_logs (event_type, actor, detail, metadata)
     VALUES ('eval.run', 'system', $1, $2) RETURNING id`,
    [`eval ${name} on ${model}: pass_rate=${passRate.toFixed(3)}`,
     JSON.stringify({ name, model, passRate, results: results.slice(0, 200) })],
  );
  logger.info({ runId: res.rows[0].id, name, model, passRate }, 'eval run recorded');
  return { runId: res.rows[0].id, passRate };
}

export async function feedbackAggregate(projectId?: string): Promise<{ up: number; down: number; rate: number }> {
  const res = await query<{ up: string; down: string }>(
    `SELECT count(*) FILTER (WHERE rating='up') AS up, count(*) FILTER (WHERE rating='down') AS down
     FROM feedback WHERE ($1::text IS NULL OR project_id=$1)`,
    [projectId ?? null],
  );
  const up = Number(res.rows[0]?.up ?? 0);
  const down = Number(res.rows[0]?.down ?? 0);
  return { up, down, rate: up + down === 0 ? 0 : up / (up + down) };
}
