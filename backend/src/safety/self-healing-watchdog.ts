import { db } from '../db/index.js';
import { LLMCircuitBreaker } from '../llm/gateway.js';

export interface WatchdogAuditResult {
  staleTasksHealed: number;
  offlineRunnersDetected: number;
  circuitsRecovered: number;
  timestamp: string;
}

export class SelfHealingWatchdog {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;

  public static startWatchdog(intervalMs = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(async () => {
      try {
        await this.runSelfHealingCycle();
      } catch (err) {
        console.error('[SelfHealingWatchdog] Error during cycle:', err);
      }
    }, intervalMs);
    this.timer.unref();
    console.log(`[SelfHealingWatchdog] Autonomous 24/7 Sentinel started (interval: ${intervalMs}ms).`);
  }

  public static stopWatchdog(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  public static async runSelfHealingCycle(): Promise<WatchdogAuditResult> {
    const now = Date.now();
    let staleTasksHealed = 0;
    let circuitsRecovered = 0;

    const staleThresholdMs = 15 * 60 * 1000;
    for (const task of db.getTasks()) {
      if (task.status === 'running') {
        const lastUpdated = new Date(task.updatedAt || task.createdAt).getTime();
        if (now - lastUpdated > staleThresholdMs) {
          db.updateTask(task.id, {
            status: 'failed',
            error: 'SelfHealingWatchdog: Task execution timed out (> 15m). Auto-recovered.'
          });
          db.addAuditLog('TASK_AUTO_HEALED', { taskId: task.id, previousStatus: 'running' });
          staleTasksHealed++;
        }
      }
    }

    const offlineRunnersDetected = db.markStaleRunnersOffline(60000);

    for (const [provider, info] of Object.entries(LLMCircuitBreaker.getStates())) {
      if (info.state === 'OPEN' && LLMCircuitBreaker.isAvailable(provider)) {
        circuitsRecovered++;
      }
    }

    return {
      staleTasksHealed,
      offlineRunnersDetected,
      circuitsRecovered,
      timestamp: new Date().toISOString()
    };
  }
}
