import { SandboxedExecutor } from '../sandbox/sandbox.js';

export class GitController {
  public static async commitChanges(worktreePath: string, message: string): Promise<{ success: boolean; commitSha: string; output: string }> {
    await SandboxedExecutor.executeCommand({
      command: 'git add -A',
      workingDir: worktreePath
    });

    const commitRes = await SandboxedExecutor.executeCommand({
      command: `git commit -m "${message.replace(/"/g, '\\"')}"`,
      workingDir: worktreePath
    });

    const shaRes = await SandboxedExecutor.executeCommand({
      command: 'git rev-parse HEAD',
      workingDir: worktreePath
    });

    return {
      success: commitRes.exitCode === 0,
      commitSha: shaRes.stdout.trim(),
      output: commitRes.stdout || commitRes.stderr
    };
  }

  public static async pushBranch(worktreePath: string, branchName: string, remote = 'origin'): Promise<{ success: boolean; output: string }> {
    const res = await SandboxedExecutor.executeCommand({
      command: `git push -u ${remote} "${branchName}"`,
      workingDir: worktreePath
    });

    return {
      success: res.exitCode === 0,
      output: res.stdout || res.stderr
    };
  }
}
