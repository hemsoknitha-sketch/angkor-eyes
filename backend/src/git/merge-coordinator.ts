import { db } from '../db/index.js';

export interface MergeQueueItem {
  id: string;
  projectId: string;
  agentId: string;
  taskId: string;
  branchName: string;
  targetBranch: string;
  status: 'queued' | 'merging' | 'completed' | 'conflict_detected';
  conflictFiles?: string[];
  enqueuedAt: string;
}

export class MergeCoordinator {
  private static queue: MergeQueueItem[] = [];
  private static isProcessing = false;

  public static enqueueMerge(params: {
    projectId: string;
    agentId: string;
    taskId: string;
    branchName: string;
    targetBranch?: string;
  }): MergeQueueItem {
    const item: MergeQueueItem = {
      id: `mq-${Date.now()}`,
      projectId: params.projectId,
      agentId: params.agentId,
      taskId: params.taskId,
      branchName: params.branchName,
      targetBranch: params.targetBranch || 'main',
      status: 'queued',
      enqueuedAt: new Date().toISOString()
    };

    this.queue.push(item);
    db.addAuditLog('MERGE_ENQUEUED', { item });
    this.processQueue();
    return item;
  }

  public static getQueue(projectId?: string): MergeQueueItem[] {
    if (projectId) return this.queue.filter(q => q.projectId === projectId);
    return this.queue;
  }

  private static async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    try {
      const nextItem = this.queue.find(q => q.status === 'queued');
      if (!nextItem) return;

      nextItem.status = 'merging';
      console.log(`[MergeCoordinator] Processing merge for ${nextItem.branchName} -> ${nextItem.targetBranch}`);

      // Allow 1.5s simulated integration & conflict test
      await new Promise(r => setTimeout(r, 1500));

      nextItem.status = 'completed';
      db.addAuditLog('MERGE_COMPLETED', { mergeId: nextItem.id, branch: nextItem.branchName }, nextItem.agentId);

      // Clean up finished items older than 5 minutes
      this.queue = this.queue.filter(q => q.status !== 'completed');
    } finally {
      this.isProcessing = false;
      if (this.queue.some(q => q.status === 'queued')) {
        this.processQueue();
      }
    }
  }
}
