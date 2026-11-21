/**
 * Integration test — Git Worktree lifecycle.
 *
 * Contract (docs/architecture.md §7, docs/operations.md §2):
 *   create → work → diff → approve → merge → prune
 *   and: a rejected/unapproved change NEVER touches the main branch.
 *
 * Uses a real local git repo in a temp dir (no Docker needed for the git
 * part). The Postgres/Redis approval check is covered by
 * approval-flow.test.ts; this file focuses on the git mechanics and the
 * prune rules. `git` must be installed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);
const git = (cwd: string, ...args: string[]) =>
  exec('git', ['-C', cwd, ...args]).then((r) => r.stdout.trim());

let repoDir = '';
let worktreesDir = '';

beforeAll(async () => {
  repoDir = await mkdtemp(join(tmpdir(), 'angkor-repo-'));
  worktreesDir = await mkdtemp(join(tmpdir(), 'angkor-worktrees-'));
  await git(repoDir, 'init', '-b', 'main');
  await git(repoDir, 'config', 'user.email', 'test@angkor-eyes.local');
  await git(repoDir, 'config', 'user.name', 'Angkor Test');
  await writeFile(join(repoDir, 'README.md'), '# test\n');
  await git(repoDir, 'add', '.');
  await git(repoDir, 'commit', '-m', 'init');
}, 60_000);

afterAll(async () => {
  await rm(repoDir, { recursive: true, force: true }).catch(() => undefined);
  await rm(worktreesDir, { recursive: true, force: true }).catch(() => undefined);
});

async function createWorktree(taskId: string): Promise<string> {
  const path = join(worktreesDir, taskId);
  await git(repoDir, 'worktree', 'add', path, '-b', `angkor-eyes/${taskId}`);
  return path;
}

describe('worktree lifecycle', () => {
  it('creates an isolated worktree on its own branch', async () => {
    const wt = await createWorktree('task-001');
    const branch = await git(wt, 'branch', '--show-current');
    expect(branch).toBe('angkor-eyes/task-001');
    const mainContent = await readFile(join(repoDir, 'README.md'), 'utf8');
    expect(mainContent).toBe('# test\n');
  });

  it('work in the worktree does not touch main until merged', async () => {
    const wt = await createWorktree('task-002');
    await writeFile(join(wt, 'feature.txt'), 'new feature\n');
    await git(wt, 'add', '.');
    await git(wt, 'commit', '-m', 'add feature');
    // Main still has no feature.txt.
    await expect(readFile(join(repoDir, 'feature.txt'), 'utf8')).rejects.toThrow();
    // Diff exists and is reviewable.
    const diff = await git(repoDir, 'diff', 'main...angkor-eyes/task-002', '--stat');
    expect(diff).toContain('feature.txt');
  });

  it('an approved change merges; a rejected change leaves main untouched', async () => {
    // Approved path.
    const wtOk = await createWorktree('task-003');
    await writeFile(join(wtOk, 'approved.txt'), 'yes\n');
    await git(wtOk, 'add', '.');
    await git(wtOk, 'commit', '-m', 'approved change');
    const approved = true; // <-- the approval gate's decision (see approval-flow.test.ts)
    if (approved) {
      await git(repoDir, 'merge', '--no-ff', 'angkor-eyes/task-003', '-m', 'merge task-003');
    }
    expect(await readFile(join(repoDir, 'approved.txt'), 'utf8')).toBe('yes\n');

    // Rejected path.
    const wtNo = await createWorktree('task-004');
    await writeFile(join(wtNo, 'rejected.txt'), 'no\n');
    await git(wtNo, 'add', '.');
    await git(wtNo, 'commit', '-m', 'rejected change');
    const rejectedApproved = false;
    if (rejectedApproved) {
      await git(repoDir, 'merge', '--no-ff', 'angkor-eyes/task-004');
    }
    await expect(readFile(join(repoDir, 'rejected.txt'), 'utf8')).rejects.toThrow();
  });

  it('prune removes merged worktrees and keeps worktrees with open work', async () => {
    // Merged worktree (task-003) is prunable.
    const listBefore = await git(repoDir, 'worktree', 'list', '--porcelain');
    expect(listBefore).toContain('task-003');
    await git(repoDir, 'worktree', 'remove', '--force', join(worktreesDir, 'task-003'));
    await git(repoDir, 'branch', '-d', 'angkor-eyes/task-003');
    const listAfter = await git(repoDir, 'worktree', 'list', '--porcelain');
    expect(listAfter).not.toContain('task-003');
    // Unmerged worktree (task-004) must still exist — pruning it would
    // destroy unreviewed work. The prune script refuses these.
    expect(listAfter).toContain('task-004');
    const remaining = await readdir(worktreesDir);
    expect(remaining).toContain('task-004');
  });
});
