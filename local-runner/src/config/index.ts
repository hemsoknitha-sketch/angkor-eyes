import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function loadEnvFile(envPath: string) {
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!(key in process.env)) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {}
}

loadEnvFile(path.resolve(process.cwd(), '../.env'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

export interface RunnerConfig {
  backendWsUrl: string;
  runnerToken: string;
  runnerId: string;
  repoRoot: string;
  worktreeBaseDir: string;
  allowedCommands: string[];
  commandTimeoutMs: number;
}

export const runnerConfig: RunnerConfig = {
  backendWsUrl: process.env.RUNNER_BACKEND_URL || 'ws://localhost:3000/runner-ws',
  runnerToken: process.env.RUNNER_TOKEN || 'angkor-runner-token-secure-key',
  runnerId: process.env.RUNNER_ID || `runner-${os.hostname()}`,
  repoRoot: path.resolve(process.cwd(), process.env.REPO_ROOT || '..'),
  worktreeBaseDir: path.resolve(process.cwd(), process.env.WORKTREE_BASE_DIR || '../worktrees'),
  allowedCommands: [
    'git', 'npm', 'pnpm', 'yarn', 'bun',
    'node', 'python', 'python3', 'pytest',
    'vitest', 'jest', 'cargo', 'go',
    'cat', 'ls', 'dir', 'echo'
  ],
  commandTimeoutMs: parseInt(process.env.RUNNER_TIMEOUT_MS || '60000', 10),
};
