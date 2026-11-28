import { createHash } from 'node:crypto';
import { query, withTx } from '../lib/db';
import { ORCHESTRATOR } from '../config';
import { logger } from '../lib/logger';
import { checkPolicy } from './policy-engine';
import { writeOutbox } from './outbox';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';

/**
 * TOCTOU-proof approvals.
 * The approval binds: action_hash (over the exact action payload), target_repo,
 * branch_name, target_commit_sha, requested_action, requested_by_agent.
 * Before execution the hash is re-computed and re-verified; if anything
 * changed (different commit, branch, or payload) a NEW approval is required.
 */
export interface ApprovalRequestInput {
  projectId: string;
  roomId: string;
  targetRepo: string;
  branchName: string;
  targetCommitSha: string;
  requestedAction: string;
  requestedByAgent: string;
  actionPayload: Record<string, unknown>;
}

export function computeActionHash(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export async function requestApproval(input: ApprovalRequestInput): Promise<{ id: string; actionHash: string; expiresAt: Date }> {
  const actionHash = computeActionHash({ ...input.actionPayload, action: input.requestedAction, repo: input.targetRepo, branch: input.branchName, commit: input.targetCommitSha });
  const expiresAt = new Date(Date.now() + ORCHESTRATOR.approvalTtlHours * 3600_000);
  const res = await query<{ id: string }>(
    `INSERT INTO approval_requests
       (project_id, room_id, target_repo, branch_name, target_commit_sha, requested_action,
        requested_by_agent, action_hash, action_payload, status, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10) RETURNING id`,
    [input.projectId, input.roomId, input.targetRepo, input.branchName, input.targetCommitSha,
     input.requestedAction, input.requestedByAgent, actionHash, JSON.stringify(input.actionPayload), expiresAt],
  );
  await writeOutbox('approval.requested', { approval_id: res.rows[0].id, action: input.requestedAction });
  return { id: res.rows[0].id, actionHash, expiresAt };
}

export async function decideApproval(id: string, approved: boolean, approvedByTelegramId: number): Promise<ApprovalStatus> {
  const status: ApprovalStatus = approved ? 'approved' : 'rejected';
  const res = await query<{ status: ApprovalStatus }>(
    `UPDATE approval_requests SET status=$2, approved_by=$3, approved_at=now(), updated_at=now()
     WHERE id=$1 AND status='pending' AND expires_at > now() RETURNING status`,
    [id, status, String(approvedByTelegramId)],
  );
  if (res.rows.length === 0) throw new Error(`approval-not-pending-or-expired:${id}`);
  await writeOutbox(`approval.${status}`, { approval_id: id });
  return status;
}

/**
 * Execute ONLY after re-verifying: approval is approved + unexpired, the
 * action hash still matches the current payload/commit, and the policy
 * engine still allows the agent to perform the action.
 */
export async function executeApproved<T>(
  approvalId: string,
  currentPayload: Record<string, unknown>,
  currentCommitSha: string,
  executor: () => Promise<T>,
): Promise<T> {
  const result = await withTx(async (client) => {
    const res = await client.query<{
      status: ApprovalStatus; action_hash: string; target_commit_sha: string;
      requested_action: string; requested_by_agent: string; expires_at: Date;
    }>(`SELECT * FROM approval_requests WHERE id=$1 FOR UPDATE`, [approvalId]);
    if (res.rows.length === 0) throw new Error(`approval-not-found:${approvalId}`);
    const a = res.rows[0];
    if (a.status !== 'approved') throw new Error(`approval-not-approved:${a.status}`);
    if (new Date(a.expires_at) <= new Date()) {
      await client.query(`UPDATE approval_requests SET status='expired' WHERE id=$1`, [approvalId]);
      throw new Error('approval-expired');
    }
    if (a.target_commit_sha !== currentCommitSha) {
      throw new Error('toctou-commit-changed: target_commit_sha differs — request a new approval');
    }
    const currentHash = computeActionHash({ ...currentPayload, action: a.requested_action });
    // The stored hash also binds repo/branch/commit; recompute with the stored
    // binding fields so a payload-only comparison is exact.
    const stored = await client.query<{ target_repo: string; branch_name: string }>(
      `SELECT target_repo, branch_name FROM approval_requests WHERE id=$1`, [approvalId],
    );
    const boundHash = computeActionHash({
      ...currentPayload, action: a.requested_action,
      repo: stored.rows[0].target_repo, branch: stored.rows[0].branch_name, commit: currentCommitSha,
    });
    if (boundHash !== a.action_hash) {
      throw new Error('toctou-action-changed: action_hash differs — request a new approval');
    }
    void currentHash;
    const policy = await checkPolicy(a.requested_by_agent, a.requested_action);
    if (!policy.allowed) throw new Error(`policy-denied:${policy.reason}`);
    return a;
  });
  void result;
  const out = await executor();
  await query(`UPDATE approval_requests SET status='executed', updated_at=now() WHERE id=$1`, [approvalId]);
  logger.info({ approvalId }, 'approved action executed');
  return out;
}

export async function expireApprovals(): Promise<number> {
  const res = await query(`UPDATE approval_requests SET status='expired' WHERE status='pending' AND expires_at <= now()`);
  return res.rowCount ?? 0;
}

export async function listPendingApprovals(projectId?: string): Promise<unknown[]> {
  const res = await query(
    `SELECT * FROM approval_requests WHERE status='pending' AND expires_at > now()
     AND ($1::text IS NULL OR project_id=$1) ORDER BY created_at ASC`,
    [projectId ?? null],
  );
  return res.rows;
}
