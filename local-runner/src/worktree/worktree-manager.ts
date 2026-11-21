import fs from 'fs';
import path from 'path';
import { runnerConfig } from '../config/index.js';
import { SandboxedExecutor } from '../sandbox/sandbox.js';

export class WorktreeManager {
  private static ensureBaseDir(): void {
    if (!fs.existsSync(runnerConfig.worktreeBaseDir)) {
      fs.mkdirSync(runnerConfig.worktreeBaseDir, { recursive: true });
    }
  }

  public static async createWorktree(params: {
    branchName: string;
    baseBranch?: string;
  }): Promise<{ worktreePath: string; branchName: string; baseCommitSha: string }> {
    this.ensureBaseDir();
    const sanitizedBranch = params.branchName.replace(/[^a-zA-Z0-9_\-\/]/g, '_');
    const folderName = sanitizedBranch.replace(/\//g, '-');
    const worktreePath = path.join(runnerConfig.worktreeBaseDir, folderName);

    // If folder already exists, clean or reuse
    if (fs.existsSync(worktreePath)) {
      console.log(`[WorktreeManager] Reusing existing worktree directory: ${worktreePath}`);
    } else {
      const base = params.baseBranch || 'main';
      const cmd = `git worktree add -b "${sanitizedBranch}" "${worktreePath}" "${base}"`;
      console.log(`[WorktreeManager] Creating git worktree: ${cmd}`);

      const res = await SandboxedExecutor.executeCommand({
        command: cmd,
        workingDir: runnerConfig.repoRoot
      });

      if (res.exitCode !== 0 && !res.stderr.includes('already exists')) {
        // Fallback: create plain branch worktree without -b if branch already exists
        await SandboxedExecutor.executeCommand({
          command: `git worktree add "${worktreePath}" "${sanitizedBranch}"`,
          workingDir: runnerConfig.repoRoot
        });
      }
    }

    // Get current base commit sha
    const shaRes = await SandboxedExecutor.executeCommand({
      command: 'git rev-parse HEAD',
      workingDir: worktreePath
    });

    const baseCommitSha = shaRes.stdout.trim() || 'initial-commit-sha';

    return {
      worktreePath,
      branchName: sanitizedBranch,
      baseCommitSha
    };
  }

  public static async getDiff(worktreePath: string): Promise<{ diff: string; stats: any }> {
    const diffRes = await SandboxedExecutor.executeCommand({
      command: 'git diff HEAD',
      workingDir: worktreePath
    });

    const statusRes = await SandboxedExecutor.executeCommand({
      command: 'git status --short',
      workingDir: worktreePath
    });

    return {
      diff: diffRes.stdout || '(No unstaged diff)',
      stats: {
        rawStatus: statusRes.stdout,
        isClean: statusRes.stdout.trim().length === 0
      }
    };
  }

  public static async removeWorktree(worktreePath: string, deleteBranch = false): Promise<boolean> {
    const cmd = `git worktree remove --force "${worktreePath}"`;
    const res = await SandboxedExecutor.executeCommand({
      command: cmd,
      workingDir: runnerConfig.repoRoot
    });

    // Prune stale worktree metadata
    await SandboxedExecutor.executeCommand({
      command: 'git worktree prune',
      workingDir: runnerConfig.repoRoot
    });

    return res.exitCode === 0;
  }
}
