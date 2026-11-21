import { query } from '../lib/db';
import { logger } from '../lib/logger';
import { checkPolicy } from './policy-engine';

/**
 * Merge Coordinator.
 * - Serialises merges to main through the merge queue (one merge at a time).
 * - Records the base commit SHA; re-checks for conflicts and re-runs
 *   tests/review on the merge candidate before merging.
 * - Never deletes the worktree / branch before a successful merge.
 */
export interface MergeRequest {
  projectId: string;
  roomId: string;
  sourceBranch: string;
  targetBranch?: string;
  baseCommitSha: string;
  headCommitSha: string;
  worktreeId: string;
  requestedByAgent: string;
}

export async function requestMerge(input: MergeRequest): Promise<{ mergeId: string; status: string }> {
  const policy = await checkPolicy(input.requestedByAgent, 'merge_pr', `${input.sourceBranch} -> ${input.targetBranch ?? 'main'}`);
  if (!policy.allowed) throw new Error(`policy-denied-merge:${policy.reason}`);
  // Merging always needs approval (risky action) — the approval service owns that gate.
  const res = await query<{ id: string }>(
    `INSERT INTO tasks (project_id, room_id, title, description, status, agent_id, metadata)
     VALUES ($1,$2,$3,$4,'waiting_approval',$5,$6) RETURNING id`,
    [input.projectId, input.roomId, `Merge ${input.sourceBranch} -> ${input.targetBranch ?? 'main'}`,
     `base=${input.baseCommitSha} head=${input.headCommitSha}`, input.requestedByAgent,
     JSON.stringify({ kind: 'merge', source_branch: input.sourceBranch, target_branch: input.targetBranch ?? 'main',
       base_commit_sha: input.baseCommitSha, head_commit_sha: input.headCommitSha, worktree_id: input.worktreeId })],
  );
  return { mergeId: res.rows[0].id, status: 'waiting_approval' };
}

/** Pre-merge checks on the candidate: conflict check + test/review re-run. */
export async function checkMergeCandidate(mergeTaskId: string): Promise<{ conflicts: boolean; testsPass: boolean; reviewPass: boolean }> {
  const res = await query<{ metadata: Record<string, unknown> }>(
    `SELECT metadata FROM tasks WHERE id=$1`, [mergeTaskId],
  );
  const meta = res.rows[0]?.metadata ?? {};
  // Conflict detection is performed by the runner against git (base SHA vs
  // current main); here we record the check outcome. A real implementation
  // calls the runner's git service — this stub returns the stored result
  // when present and defaults to "needs check" (conflicts=true) otherwise.
  const conflicts = (meta.conflicts as boolean | undefined) ?? true;
  const testsPass = (meta.tests_pass as boolean | undefined) ?? false;
  const reviewPass = (meta.review_pass as boolean | undefined) ?? false;
  logger.info({ mergeTaskId, conflicts, testsPass, reviewPass }, 'merge candidate checked');
  return { conflicts, testsPass, reviewPass };
}

/** Execute the merge (called only after approval + passing checks). */
export async function executeMerge(mergeTaskId: string): Promise<void> {
  const checks = await checkMergeCandidate(mergeTaskId);
  if (checks.conflicts) throw new Error('merge-blocked: conflicts present');
  if (!checks.testsPass || !checks.reviewPass) throw new Error('merge-blocked: tests or review not passing');
  // The runner performs the actual git merge; on success it calls completeMerge().
  await query(`UPDATE tasks SET status='running' WHERE id=$1`, [mergeTaskId]);
}

/** Called by the runner after a successful git merge — only now may the worktree/branch go. */
export async function completeMerge(mergeTaskId: string, mergeCommitSha: string): Promise<void> {
  await query(
    `UPDATE tasks SET status='completed', metadata = metadata || $2 WHERE id=$1`,
    [mergeTaskId, JSON.stringify({ merge_commit_sha: mergeCommitSha, merged_at: new Date().toISOString() })],
  );
  logger.info({ mergeTaskId, mergeCommitSha }, 'merge completed — worktree/branch may now be cleaned up');
}
