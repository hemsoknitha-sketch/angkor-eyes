/**
 * worktree.ts — Git Worktree Manager (ANGKOR EYES runner).
 * One isolated worktree per (project, agent, task):
 *   git worktree add ../worktrees/<project>-<agent>-task<id> -b agent/<role>/task<id> main
 * All agent file edits happen ONLY inside that worktree. Main checkout is
 * never touched by an agent.
 */
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  path: string;
  branch: string;
  headSha: string;
  project: string;
  agentRole: string;
  taskId: string;
}

function git(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  // execFile (no shell) — no shell injection via branch/task names.
  return execFileAsync("git", args, { cwd, timeout: 60_000 });
}

export function worktreeName(project: string, agentRole: string, taskId: string): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "-");
  return `${safe(project)}-${safe(agentRole)}-task${safe(taskId)}`;
}
export function branchName(agentRole: string, taskId: string): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._/-]/g, "-");
  return `agent/${safe(agentRole)}/task${safe(taskId)}`;
}

export class WorktreeManager {
  constructor(private repoPath: string, private worktreesRoot: string = path.join(process.cwd(), "..", "worktrees")) {}

  async create(project: string, agentRole: string, taskId: string, base = "main"): Promise<WorktreeInfo> {
    const name = worktreeName(project, agentRole, taskId);
    const branch = branchName(agentRole, taskId);
    const target = path.join(this.worktreesRoot, name);
    if (fs.existsSync(target)) throw new Error(`Worktree already exists: ${target}`);
    fs.mkdirSync(this.worktreesRoot, { recursive: true });
    await git(["worktree", "add", target, "-b", branch, base], this.repoPath);
    const { stdout } = await git(["rev-parse", "HEAD"], target);
    return { path: target, branch, headSha: stdout.trim(), project, agentRole, taskId };
  }

  async remove(worktreePath: string, force = false): Promise<void> {
    const args = ["worktree", "remove", ...(force ? ["--force"] : []), worktreePath];
    await git(args, this.repoPath);
  }

  async prune(): Promise<void> { await git(["worktree", "prune"], this.repoPath); }

  async list(): Promise<{ path: string; branch: string; headSha: string }[]> {
    const { stdout } = await git(["worktree", "list", "--porcelain"], this.repoPath);
    const out: { path: string; branch: string; headSha: string }[] = [];
    let cur: { path: string; branch: string; headSha: string } = { path: "", branch: "", headSha: "" };
    for (const line of stdout.split("\n")) {
      if (line.startsWith("worktree ")) { if (cur.path) out.push(cur); cur = { path: line.slice(9), branch: "", headSha: "" }; }
      else if (line.startsWith("branch ")) cur.branch = line.slice(7);
      else if (line.startsWith("HEAD ")) cur.headSha = line.slice(5);
    }
    if (cur.path) out.push(cur);
    return out;
  }

  async status(worktreePath: string): Promise<string> {
    const { stdout } = await git(["status", "--porcelain"], worktreePath);
    return stdout;
  }

  async headSha(worktreePath: string): Promise<string> {
    const { stdout } = await git(["rev-parse", "HEAD"], worktreePath);
    return stdout.trim();
  }
}
