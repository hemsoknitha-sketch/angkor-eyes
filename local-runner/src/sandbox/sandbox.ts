import { exec } from 'child_process';
import path from 'path';
import { runnerConfig } from '../config/index.js';

export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class SandboxedExecutor {
  /**
   * Verify that path is strictly within the allowed workspace boundary.
   */
  public static validatePath(targetPath: string): { valid: boolean; resolvedPath: string; error?: string } {
    const resolved = path.resolve(targetPath);
    const inWorktree = resolved.startsWith(runnerConfig.worktreeBaseDir);
    const inRepo = resolved.startsWith(runnerConfig.repoRoot);

    if (!inWorktree && !inRepo) {
      return {
        valid: false,
        resolvedPath: resolved,
        error: `Path traversal blocked: ${resolved} is outside allowed directories (${runnerConfig.worktreeBaseDir})`
      };
    }

    return { valid: true, resolvedPath: resolved };
  }

  /**
   * Run command with strict binary allowlist, timeout, and path boundary.
   */
  public static async executeCommand(params: {
    command: string;
    workingDir: string;
    timeoutMs?: number;
  }): Promise<CommandExecutionResult> {
    const startTime = Date.now();

    // 1. Path check
    const pathCheck = this.validatePath(params.workingDir);
    if (!pathCheck.valid) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: pathCheck.error || 'Path validation failed',
        durationMs: Date.now() - startTime
      };
    }

    // 2. Binary Allowlist check
    const trimmed = params.command.trim();
    const binary = trimmed.split(/[\s"']+/)[0].toLowerCase();
    const cleanBinary = path.basename(binary).replace(/\.exe$/i, '');

    const isAllowed = runnerConfig.allowedCommands.includes(cleanBinary);
    if (!isAllowed) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Security Policy Violation: Command '${cleanBinary}' is not in the allowed runner whitelist.`,
        durationMs: Date.now() - startTime
      };
    }

    // 3. Reject high-risk shell patterns
    if (/[;&|`$><]/.test(trimmed) && /(?:rm\s+-rf|mkfs|dd|del\s+\/s|curl\s+.*\|\s*sh)/i.test(trimmed)) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Security Policy Violation: Dangerous command chaining pattern detected.',
        durationMs: Date.now() - startTime
      };
    }

    // 4. Controlled Execution
    return new Promise((resolve) => {
      const timeout = params.timeoutMs || runnerConfig.commandTimeoutMs;

      exec(trimmed, {
        cwd: pathCheck.resolvedPath,
        timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }, (error, stdout, stderr) => {
        const durationMs = Date.now() - startTime;
        if (error) {
          resolve({
            exitCode: error.code || 1,
            stdout: stdout.toString(),
            stderr: stderr.toString() || error.message,
            durationMs
          });
        } else {
          resolve({
            exitCode: 0,
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            durationMs
          });
        }
      });
    });
  }
}
