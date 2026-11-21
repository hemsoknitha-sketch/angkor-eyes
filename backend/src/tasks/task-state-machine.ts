import { db } from '../db/index.js';
import type { Task, TaskStatus } from '../db/schema.js';

export class TaskStateMachine {
  private static validTransitions: Record<TaskStatus, TaskStatus[]> = {
    pending: ['running', 'cancelled'],
    running: ['waiting_approval', 'completed', 'failed', 'cancelled'],
    waiting_approval: ['running', 'completed', 'failed', 'cancelled'],
    completed: [],
    failed: ['pending'], // allow retry
    cancelled: []
  };

  public static transition(taskId: string, targetStatus: TaskStatus, details?: string): Task {
    const task = db.getTaskById(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const allowed = this.validTransitions[task.status];
    if (!allowed.includes(targetStatus)) {
      throw new Error(`Invalid state transition from ${task.status} to ${targetStatus} for task ${taskId}`);
    }

    const updated = db.updateTask(taskId, { status: targetStatus });
    if (!updated) throw new Error(`Failed to update task ${taskId}`);

    db.addAuditLog('TASK_STATE_TRANSITION', {
      taskId,
      from: task.status,
      to: targetStatus,
      details
    });

    return updated;
  }
}
