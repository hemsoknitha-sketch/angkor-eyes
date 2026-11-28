import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runnerConfig } from '../config/index.js';

export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

const BLOCKED_SHELL_METACHARS = /[;&|`$><\r\n]/;

function tokenizeArgv(cmdLine: string): string[] {
  const args: string[] = [];
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cmdLine)) !== null) {
    args.push(match[1] ?? match[2] ?? match[0]);
  }
  return args;
}

export class SandboxedExecutor {
  public static validatePath(targetPath: string): { valid: boolean; resolvedPath: string; error?: string } {
    const resolved = path.resolve(targetPath);
    const realTarget = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
    const worktreeRoot = fs.existsSync(runnerConfig.worktreeBaseDir)
      ? fs.realpathSync(runnerConfig.worktreeBaseDir)
      : path.resolve(runnerConfig.worktreeBaseDir);
    const repoRoot = fs.existsSync(runnerConfig.repoRoot)
      ? fs.realpathSync(runnerConfig.repoRoot)
      : path.resolve(runnerConfig.repoRoot);

    const isInside = (child: string, parent: string) =>
      child === parent || child.startsWith(parent + path.sep);

    if (!isInside(realTarget, worktreeRoot) && !isInside(realTarget, repoRoot)) {
      return {
        valid: false,
        resolvedPath: realTarget,
        error: `Path traversal blocked: ${realTarget} is outside allowed workspace.`
      };
    }
    return { valid: true, resolvedPath: realTarget };
  }

  public static async executeCommand(params: {
    command: string;
    workingDir: string;
    timeoutMs?: number;
  }): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    const pathCheck = this.validatePath(params.workingDir);
    if (!pathCheck.valid) {
      return { exitCode: 1, stdout: '', stderr: pathCheck.error || 'Invalid path', durationMs: Date.now() - startTime };
    }

    const trimmed = params.command.trim();
    if (!trimmed || BLOCKED_SHELL_METACHARS.test(trimmed)) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Security Policy Violation: Shell chaining, redirection, or empty command blocked.',
        durationMs: Date.now() - startTime
      };
    }

    const argv = tokenizeArgv(trimmed);
    const cleanBinary = path.basename(argv[0]).replace(/\.(exe|cmd|bat)$/i, '').toLowerCase();

    if (!runnerConfig.allowedCommands.includes(cleanBinary)) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Security Policy Violation: Command '${cleanBinary}' is not allowlisted.`,
        durationMs: Date.now() - startTime
      };
    }

    if (cleanBinary === 'git' && argv.some(a => a.includes('hooksPath') || a.includes('upload-pack'))) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Security Policy Violation: Git hook override blocked.',
        durationMs: Date.now() - startTime
      };
    }

    return new Promise((resolve) => {
      const timeout = params.timeoutMs || runnerConfig.commandTimeoutMs;
      const isWin = process.platform === 'win32' && ['npm', 'pnpm', 'yarn', 'npx', 'vitest'].includes(cleanBinary);
      const binToRun = isWin ? `${cleanBinary}.cmd` : cleanBinary;

      execFile(
        binToRun,
        argv.slice(1),
        { cwd: pathCheck.resolvedPath, timeout, maxBuffer: 10 * 1024 * 1024, shell: false },
        (error, stdout, stderr) => {
          const durationMs = Date.now() - startTime;
          if (error) {
            const code = typeof (error as any).code === 'number' ? (error as any).code : 1;
            resolve({ exitCode: code, stdout: String(stdout), stderr: String(stderr) || error.message, durationMs });
          } else {
            resolve({ exitCode: 0, stdout: String(stdout), stderr: String(stderr), durationMs });
          }
        }
      );
    });
  }
}
