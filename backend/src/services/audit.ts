import { query } from '../lib/db';
import { logger } from '../lib/logger';
import { redactSecretsText } from '../lib/secrets-redaction';

/**
 * Audit Logs — immutable, append-only.
 * Stores: LLM input/output (redacted), model version, tool calls, git SHAs,
 * diff summaries, test results. This gives traceability; it is NOT a claim
 * of 100% replay — non-deterministic LLM calls cannot be replayed exactly.
 * Rows are never updated/deleted by application code (see schema: no UPDATE
 * grant in the app role's migration notes; revoke in production).
 */
export interface AuditEntry {
  projectId?: string | null;
  roomId?: string | null;
  taskId?: string | null;
  agentId?: string | null;
  userTelegramId?: number | null;
  eventType: string;
  actor: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

export async function audit(entry: AuditEntry): Promise<string> {
  const safeDetail = redactSecretsText(entry.detail);
  const safeMeta = entry.metadata ? JSON.parse(redactSecretsText(JSON.stringify(entry.metadata))) as Record<string, unknown> : {};
  const res = await query<{ id: string }>(
    `INSERT INTO audit_logs (project_id, room_id, task_id, agent_id, user_telegram_id, event_type, actor, detail, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [entry.projectId ?? null, entry.roomId ?? null, entry.taskId ?? null, entry.agentId ?? null,
     entry.userTelegramId ?? null, entry.eventType, entry.actor, safeDetail, JSON.stringify(safeMeta)],
  );
  return res.rows[0].id;
}

export async function auditLlmCall(input: {
  projectId?: string | null; agentId?: string | null; taskId?: string | null;
  model: string; provider: string; inputText: string; outputText: string;
  inputTokens: number; outputTokens: number; toolCalls?: unknown; gitSha?: string;
}): Promise<string> {
  return audit({
    projectId: input.projectId, agentId: input.agentId, taskId: input.taskId,
    eventType: 'llm.call', actor: input.agentId ?? 'system',
    detail: `LLM ${input.provider}/${input.model} in=${input.inputTokens} out=${input.outputTokens}${input.gitSha ? ` sha=${input.gitSha}` : ''}`,
    metadata: {
      model: input.model, provider: input.provider,
      input: redactSecretsText(input.inputText.slice(0, 8000)),
      output: redactSecretsText(input.outputText.slice(0, 8000)),
      tool_calls: input.toolCalls ?? null,
    },
  });
}

export async function listAuditLogs(filter: { projectId?: string; limit?: number; offset?: number }): Promise<unknown[]> {
  const res = await query(
    `SELECT * FROM audit_logs WHERE ($1::text IS NULL OR project_id=$1)
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [filter.projectId ?? null, filter.limit ?? 100, filter.offset ?? 0],
  );
  return res.rows;
}

export function logAuditStart(): void {
  logger.info('audit log writer ready (append-only)');
}
