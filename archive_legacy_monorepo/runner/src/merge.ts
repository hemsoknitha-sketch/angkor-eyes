/**
 * merge.ts — Merge Coordinator client (ANGKOR EYES runner).
 * The runner does the local mechanics; the backend Approval Gate owns the
 * decision. Flow: check base SHA is still current -> conflict check
 * (merge-tree) -> rebase agent branch onto main -> re-run tests ->
 * report result to backend, which performs/merges or asks the runner to.
 * Never merge main locally without an approved approval.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { runAllowedCommand } from "./executor";

const execFileAsync = promisify(execFile);

export interface MergeCheck { baseSha: string; headSha: string; conflicts: string[]; canMerge: boolean; }

export async function checkMerge(repoPath: string, branch: string, base = "main"): Promise<MergeCheck> {
  const baseSha = (await execFileAsync("git", ["rev-parse", base], { cwd: repoPath })).stdout.trim();
  const headSha = (await execFileAsync("git", ["rev-parse", branch], { cwd: repoPath })).stdout.trim();
  // git merge-tree --write-tree <base> <head> reports conflicts without touching the tree.
  const { stdout } = await execFileAsync("git", ["merge-tree", "--write-tree", baseSha, headSha], { cwd: repoPath });
  const conflicts = stdout.split("\n").filter((l) => l.startsWith("<<<<<<<") || l.includes("CONFLICT")).map((l) => l.trim());
  // Simpler robust check: `git merge-tree` exit + conflict markers in output.
  const hasConflict = stdout.includes("<<<<<<<") || stdout.toLowerCase().includes("conflict");
  return { baseSha, headSha, conflicts: hasConflict ? conflicts : [], canMerge: !hasConflict };
}

export async function rebaseOntoMain(worktreePath: string, base = "main"): Promise<void> {
  await execFileAsync("git", ["fetch", "origin", base], { cwd: worktreePath, timeout: 120_000 });
  await execFileAsync("git", ["rebase", `origin/${base}`], { cwd: worktreePath, timeout: 300_000 });
}

export async function reRunTests(worktreePath: string, taskId: string): Promise<{ passed: boolean; output: string }> {
  // Detect test runner from package.json / pyproject presence.
  const { existsSync } = await import("fs");
  const cmd = existsSync(`${worktreePath}/pyproject.toml`) || existsSync(`${worktreePath}/pytest.ini`)
    ? ["pytest", "-q"]
    : ["npm", "test"];
  const res = await runAllowedCommand({ taskId, agentRole: "qa", command: cmd, worktreePath, risk: "safe" });
  return { passed: res.exitCode === 0, output: (res.stdout + res.stderr).slice(0, 20_000) };
}
