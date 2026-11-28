import { db } from '../db/index.js';
import { runnerHub } from '../runner-hub/hub.js';
import { ApprovalGate } from '../safety/approval-gate.js';
import { CronScheduler } from '../scheduler/cron-scheduler.js';

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

  public static async executeRollback(
    snapshotId: string,
    opts?: { approvalId?: string; currentCommitSha?: string; worktreePath?: string }
  ): Promise<{ success: boolean; message: string; approvalId?: string }> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return { success: false, message: `Snapshot ${snapshotId} not found.` };
    }

    const approvalId = opts?.approvalId;
    if (approvalId) {
      const approval = db.getApprovalById(approvalId);
      if (!approval || approval.status !== 'approved') {
        return {
          success: false,
          approvalId,
          message: `Rollback requires approved status on approval ${approvalId} (current: ${approval?.status || 'missing'}).`,
        };
      }
      const toctou = ApprovalGate.validateExecution(
        approvalId,
        opts?.currentCommitSha || approval.targetCommitSha
      );
      if (!toctou.valid) {
        return {
          success: false,
          approvalId,
          message: `Rollback aborted by TOCTOU gate: ${toctou.reason}`,
        };
      }
    }

    try {
      const res = await runnerHub.executeOnRunner({
        action: 'RESET_HARD',
        payload: {
          commitSha: snapshot.preMergeCommitSha,
          workingDir: opts?.worktreePath || '.',
          worktreePath: opts?.worktreePath || '.'
        }
      });

      snapshot.status = 'rolled_back';
      db.addAuditLog('GIT_ROLLBACK_EXECUTED', {
        snapshotId,
        approvalId,
        preMergeCommitSha: snapshot.preMergeCommitSha
      });
      CronScheduler.enqueueOutboxEvent('git_rollback_executed', {
        snapshotId,
        approvalId,
        commitSha: snapshot.preMergeCommitSha
      });

      return {
        success: true,
        approvalId,
        message: `Successfully rolled back to commit ${snapshot.preMergeCommitSha} (Approval: ${approvalId}). ${res?.stdout || ''}`.trim()
      };
    } catch (err: any) {
      return { success: false, approvalId, message: `Rollback failed: ${err.message}` };
    }
  }

  public static listSnapshots(projectId?: string): RollbackSnapshot[] {
    const arr = Array.from(this.snapshots.values());
    return projectId ? arr.filter(s => s.projectId === projectId) : arr;
  }
}
