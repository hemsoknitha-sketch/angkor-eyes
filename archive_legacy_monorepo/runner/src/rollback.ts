/**
 * rollback.ts — Rollback / Undo (ANGKOR EYES runner).
 * Before any merge, snapshot the target branch HEAD (base SHA) so a bad
 * merge can be restored. Rollback = `git revert` of the merge commit when
 * possible, else hard reset of main to the snapshot SHA (local only, then
 * force-with-lease push of main — requires a fresh approval).
 */
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface Snapshot { baseSha: string; branch: string; createdAt: string; taskId: string; }

export async function snapshotBeforeMerge(repoPath: string, taskId: string, branch = "main"): Promise<Snapshot> {
  const baseSha = (await execFileAsync("git", ["rev-parse", branch], { cwd: repoPath })).stdout.trim();
  const snap: Snapshot = { baseSha, branch, createdAt: new Date().toISOString(), taskId };
  const dir = path.join(repoPath, ".angkor-eyes", "snapshots");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${taskId}.json`), JSON.stringify(snap, null, 2));
  return snap;
}

export function loadSnapshot(repoPath: string, taskId: string): Snapshot {
  return JSON.parse(fs.readFileSync(path.join(repoPath, ".angkor-eyes", "snapshots", `${taskId}.json`), "utf8")) as Snapshot;
}

/** Revert a merge commit (safe, history-preserving). Returns the revert commit SHA. */
export async function revertMerge(repoPath: string, mergeSha: string): Promise<string> {
  await execFileAsync("git", ["revert", "-m", "1", "--no-edit", mergeSha], { cwd: repoPath, timeout: 120_000 });
  return (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoPath })).stdout.trim();
}

/** Last resort: reset the branch to the pre-merge snapshot SHA (local). Caller must push with approval. */
export async function restoreSnapshot(repoPath: string, snap: Snapshot): Promise<void> {
  await execFileAsync("git", ["reset", "--hard", snap.baseSha], { cwd: repoPath, timeout: 120_000 });
}
