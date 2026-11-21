/**
 * git-push.ts — Git Push Controller (ANGKOR EYES runner).
 * Push ONLY after an approved approval, and ONLY after re-verifying
 * action_hash + target commit SHA against the approval payload.
 * Push target is always the agent branch (agent/<role>/task<id>) — never main.
 * Any mismatch => refuse, audit, and report to backend.
 */
import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface ApprovalPayload {
  approval_id: string;
  action_hash: string;
  target_repo: string;
  branch_name: string;
  target_commit_sha: string;
  requested_action: string;
  requested_by_agent: string;
  expires_at: string;
  approved_by: string;
  approved_at: string;
  status: "approved" | "pending" | "rejected" | "expired";
}

export function computeActionHash(action: { requested_action: string; branch_name: string; target_commit_sha: string }): string {
  return createHash("sha256")
    .update(JSON.stringify([action.requested_action, action.branch_name, action.target_commit_sha]))
    .digest("hex");
}

/** Re-verify an approval before pushing. Returns an error string or null (OK). */
export async function verifyApprovalForPush(
  approval: ApprovalPayload,
  worktreePath: string,
  expectedAction: string,
): Promise<string | null> {
  if (approval.status !== "approved") return `Approval ${approval.approval_id} is not approved (status=${approval.status}).`;
  if (new Date(approval.expires_at).getTime() < Date.now()) return `Approval ${approval.approval_id} expired at ${approval.expires_at}.`;
  if (approval.requested_action !== expectedAction) return `Approval action mismatch: ${approval.requested_action} != ${expectedAction}.`;
  if (approval.branch_name.startsWith("main") || approval.branch_name === "main") return "Push to main is forbidden from the runner.";
  const headSha = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: worktreePath })).stdout.trim();
  if (headSha !== approval.target_commit_sha) {
    return `Commit SHA mismatch (TOCTOU): worktree HEAD ${headSha} != approved ${approval.target_commit_sha}. Re-request approval.`;
  }
  const expectedHash = computeActionHash({
    requested_action: approval.requested_action,
    branch_name: approval.branch_name,
    target_commit_sha: approval.target_commit_sha,
  });
  if (expectedHash !== approval.action_hash) return `action_hash mismatch for approval ${approval.approval_id}.`;
  const branch = (await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: worktreePath })).stdout.trim();
  if (branch !== approval.branch_name) return `Branch mismatch: ${branch} != ${approval.branch_name}.`;
  return null;
}

export async function pushApprovedBranch(worktreePath: string, approval: ApprovalPayload): Promise<void> {
  const err = await verifyApprovalForPush(approval, worktreePath, approval.requested_action);
  if (err) throw new Error(`Push refused: ${err}`);
  // --force-with-lease only, never --force; push only the agent branch.
  await execFileAsync("git", ["push", "--force-with-lease", "origin", approval.branch_name], { cwd: worktreePath, timeout: 120_000 });
}
