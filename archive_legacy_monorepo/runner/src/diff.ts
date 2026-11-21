/**
 * diff.ts — Diff Generator (ANGKOR EYES runner).
 * Produces `git diff` + file stats (+42 -18 style) for a worktree,
 * redacted before it is sent anywhere (diffs can contain secrets).
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { Redactor } from "./redaction";

const execFileAsync = promisify(execFile);

export interface FileStat { file: string; added: number; removed: number; }
export interface DiffResult {
  baseSha: string; headSha: string;
  files: FileStat[];
  totalAdded: number; totalRemoved: number;
  summary: string; // e.g. "3 files changed, +42 -18"
  diff: string;    // redacted unified diff
}

export async function generateDiff(worktreePath: string, base = "main"): Promise<DiffResult> {
  const redactor = new Redactor();
  const baseSha = (await execFileAsync("git", ["merge-base", "HEAD", base], { cwd: worktreePath })).stdout.trim();
  const headSha = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: worktreePath })).stdout.trim();
  const numstat = (await execFileAsync("git", ["diff", "--numstat", `${baseSha}..HEAD`], { cwd: worktreePath })).stdout;
  const files: FileStat[] = [];
  let totalAdded = 0, totalRemoved = 0;
  for (const line of numstat.trim().split("\n").filter(Boolean)) {
    const [a, r, file] = line.split("\t");
    const added = a === "-" ? 0 : parseInt(a, 10);
    const removed = r === "-" ? 0 : parseInt(r, 10);
    files.push({ file, added, removed });
    totalAdded += added; totalRemoved += removed;
  }
  const rawDiff = (await execFileAsync("git", ["diff", `${baseSha}..HEAD`], { cwd: worktreePath, maxBuffer: 20 * 1024 * 1024 })).stdout;
  return {
    baseSha, headSha, files, totalAdded, totalRemoved,
    summary: `${files.length} file${files.length === 1 ? "" : "s"} changed, +${totalAdded} -${totalRemoved}`,
    diff: redactor.redact(rawDiff),
  };
}
