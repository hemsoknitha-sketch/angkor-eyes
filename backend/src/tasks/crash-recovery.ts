import { db } from '../db/index.js';
import { TaskStateMachine } from './task-state-machine.js';

export class CrashRecoveryManager {
  /**
   * Run startup recovery scan to detect orphaned or in-flight tasks after unexpected shutdown.
   */
  public static runStartupRecovery(): { recoveredCount: number; failedCount: number } {
    const tasks = db.getTasks();
    let recoveredCount = 0;
    let failedCount = 0;

    for (const task of tasks) {
      if (task.status === 'running') {
        const checkpoints = db.getCheckpoints(task.id);
        if (checkpoints.length > 0 && task.retryCount < task.maxRetries) {
          console.log(`[CrashRecovery] Resuming task ${task.id} from checkpoint step ${checkpoints[0].stepIndex}`);
          db.updateTask(task.id, {
            retryCount: task.retryCount + 1,
            currentStep: checkpoints[0].stepIndex
          });
          recoveredCount++;
        } else {
          console.warn(`[CrashRecovery] Marking orphaned task ${task.id} as failed (max retries reached).`);
          try {
            TaskStateMachine.transition(task.id, 'failed', 'System crash or runner lease expired.');
            failedCount++;
          } catch (e) {
            db.updateTask(task.id, { status: 'failed' });
          }
        }
      }
    }

    if (recoveredCount > 0 || failedCount > 0) {
      db.addAuditLog('CRASH_RECOVERY_EXECUTED', { recoveredCount, failedCount });
    }

    return { recoveredCount, failedCount };
  }

  /**
   * Manual retry for a failed task.
   */
  public static retryTask(taskId: string): boolean {
    const task = db.getTaskById(taskId);
    if (!task) return false;

    db.updateTask(taskId, {
      status: 'pending',
      retryCount: 0,
      currentStep: 0
    });

    db.addAuditLog('TASK_MANUAL_RETRY', { taskId });
    return true;
  }
}
