/**
 * executor.ts — Sandboxed Tool Executor (ANGKOR EYES runner).
 * Command allowlist ONLY: git, npm test, pnpm test, pytest, lint.
 * Blocked: rm -rf, shell chaining (&& ; | ` $()), symlinks / path
 * traversal outside the worktree, git hooks execution, npm lifecycle
 * scripts (preinstall/postinstall etc. — run with --ignore-scripts).
 * All file I/O is confined to worktreePath (realpath check).
 */
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";

export type ActionRisk = "safe" | "risky";
export interface ExecRequest {
  taskId: string;
  agentRole: string;
  command: string[];          // argv, never a shell string
  worktreePath: string;
  risk: ActionRisk;
  approvalId?: string;        // required when risk === "risky"
  approvalHash?: string;
  timeoutMs?: number;
}
export interface ExecResult { exitCode: number | null; stdout: string; stderr: string; blockedReason?: string; }

const ALLOWED: { cmd: string; args: RegExp }[] = [
  { cmd: "git", args: /^(status|diff|log|add|commit|fetch|rev-parse|worktree|branch|checkout|stash|show)\b/ },
  { cmd: "npm", args: /^(test|run\s+(test|lint|typecheck|build))(\s|$)/ },
  { cmd: "pnpm", args: /^(test|lint|typecheck|build)(\s|$)/ },
  { cmd: "pytest", args: /.*/ },
  { cmd: "npx", args: /^(eslint|prettier|tsc)(\s|$)/ },
];

const BLOCKED_TOKENS = ["&&", "||", ";", "|", "`", "$(", ">", "<", "sudo", "curl", "wget", "chmod", "chown"];
const HOOK_NAMES = new Set(["pre-commit", "post-commit", "pre-push", "post-checkout", "pre-rebase"]);

export function validateCommand(req: ExecRequest): string | null {
  if (req.risk === "risky" && (!req.approvalId || !req.approvalHash)) {
    return "Risky action requires an approved approval_id + action_hash from the backend Approval Gate — never execute risky locally without it.";
  }
  if (req.command.length === 0) return "Empty command.";
  const [cmd, ...rest] = req.command;
  const joined = req.command.join(" ");
  for (const tok of BLOCKED_TOKENS) {
    if (joined.includes(tok)) return `Blocked token in command: ${tok}`;
  }
  if (joined.includes("rm -rf") || joined.includes("rm -r")) return "Blocked: rm -rf";
  const rule = ALLOWED.find((r) => r.cmd === cmd);
  if (!rule) return `Command not in allowlist: ${cmd}`;
  if (!rule.args.test(rest.join(" "))) return `Arguments not allowed for ${cmd}: ${rest.join(" ")}`;
  // git hooks execution guard: never run anything under .git/hooks
  if (cmd === "git" && rest.some((a) => a.includes("hooks") || HOOK_NAMES.has(path.basename(a)))) {
    return "Blocked: git hooks execution is forbidden.";
  }
  // npm lifecycle script guard
  if ((cmd === "npm" || cmd === "pnpm") && rest.some((a) => /^(pre|post)(install|publish|test)/.test(a))) {
    return "Blocked: npm lifecycle scripts are forbidden; use --ignore-scripts.";
  }
  return null;
}

/** Resolve a path and ensure it stays inside the worktree (no traversal / symlink escape). */
export function resolveInsideWorktree(worktreePath: string, rel: string): string {
  const root = fs.realpathSync(worktreePath);
  const target = path.resolve(root, rel);
  const real = fs.existsSync(target) ? fs.realpathSync(target) : target;
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw new Error(`Path traversal blocked: ${rel} escapes worktree`);
  }
  return target;
}

export function readFileInWorktree(worktreePath: string, rel: string): string {
  return fs.readFileSync(resolveInsideWorktree(worktreePath, rel), "utf8");
}

export function writeFileInWorktree(worktreePath: string, rel: string, content: string): void {
  const target = resolveInsideWorktree(worktreePath, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

export function runAllowedCommand(req: ExecRequest): Promise<ExecResult> {
  const blocked = validateCommand(req);
  if (blocked) return Promise.resolve({ exitCode: null, stdout: "", stderr: blocked, blockedReason: blocked });
  const [cmd, ...args] = req.command;
  const extraArgs = cmd === "npm" || cmd === "pnpm" ? ["--ignore-scripts"] : [];
  return new Promise((resolve) => {
    const child = execFile(cmd, [...extraArgs, ...args], {
      cwd: req.worktreePath,
      timeout: req.timeoutMs ?? 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, CI: "true" },
      shell: false, // never a shell — no chaining / substitution
    }, (err, stdout, stderr) => {
      resolve({ exitCode: err ? (err as { code?: number }).code ?? 1 : 0, stdout, stderr });
    });
  });
}
