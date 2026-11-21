import { db } from '../db/index.js';
import { runnerHub } from '../runner-hub/hub.js';

export interface RollbackSnapshot {
  id: string;
  projectId: string;
  branchName: string;
  targetBranch: string;
  preMergeCommitSha: string;
  mergeCommitSha?: string;
  status: 'active' | 'rolled_back';
  createdAt: string;
}

export class GitRollbackController {
  private static snapshots: Map<string, RollbackSnapshot> = new Map();

  /**
   * Save a snapshot before performing any merge into main.
   */
  public static recordPreMergeSnapshot(params: {
    projectId: string;
    branchName: string;
    targetBranch: string;
    preMergeCommitSha: string;
  }): RollbackSnapshot {
    const snapshot: RollbackSnapshot = {
      id: `snap-${Date.now()}`,
      projectId: params.projectId,
      branchName: params.branchName,
      targetBranch: params.targetBranch,
      preMergeCommitSha: params.preMergeCommitSha,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    this.snapshots.set(snapshot.id, snapshot);
    db.addAuditLog('GIT_SNAPSHOT_RECORDED', { snapshot });
    return snapshot;
  }

  /**
   * Rollback / Undo a merge: Reverts merge commit or resets to pre-merge commit.
   */
  public static async executeRollback(snapshotId: string): Promise<{ success: boolean; message: string }> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return { success: false, message: `Snapshot ${snapshotId} not found.` };
    }

    try {
      // Execute git rollback command via runner hub
      const res = await runnerHub.executeOnRunner({
        action: 'EXEC_TOOL',
        payload: {
          command: `git reset --hard ${snapshot.preMergeCommitSha}`,
          workingDir: '.'
        }
      });

      snapshot.status = 'rolled_back';
      db.addAuditLog('GIT_ROLLBACK_EXECUTED', { snapshotId, preMergeCommitSha: snapshot.preMergeCommitSha });

      return {
        success: true,
        message: `Successfully rolled back to commit ${snapshot.preMergeCommitSha}. (Output: ${res.stdout || 'clean'})`
      };
    } catch (err: any) {
      console.error('[GitRollback] Rollback error:', err);
      return { success: false, message: `Rollback failed: ${err.message}` };
    }
  }

  public static listSnapshots(projectId?: string): RollbackSnapshot[] {
    const arr = Array.from(this.snapshots.values());
    if (projectId) return arr.filter(s => s.projectId === projectId);
    return arr;
  }
}
