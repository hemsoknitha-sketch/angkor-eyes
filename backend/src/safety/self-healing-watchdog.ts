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

  /**
   * Starts the 24/7 background self-healing sentinel.
   */
  public static startWatchdog(intervalMs = 30000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(async () => {
      try {
        await this.runSelfHealingCycle();
      } catch (err) {
        console.error('[SelfHealingWatchdog] Error during cycle:', err);
      }
    }, intervalMs);

    console.log(`🛡️ [SelfHealingWatchdog] Autonomous 24/7 Self-Healing Sentinel started (interval: ${intervalMs}ms).`);
  }

  public static stopWatchdog(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  /**
   * Run a single self-healing cycle.
   */
  public static async runSelfHealingCycle(): Promise<WatchdogAuditResult> {
    const now = Date.now();
    let staleTasksHealed = 0;
    let offlineRunnersDetected = 0;
    let circuitsRecovered = 0;

    // 1. Audit Stale In-Flight Tasks (> 15 minutes without progress)
    const tasks = db.getTasks();
    const staleThresholdMs = 15 * 60 * 1000;

    for (const task of tasks) {
      if (task.status === 'running') {
        const lastUpdated = new Date(task.updatedAt || task.createdAt).getTime();
        if (now - lastUpdated > staleThresholdMs) {
          db.updateTask(task.id, {
            status: 'failed',
            error: 'SelfHealingWatchdog: Task execution timed out (> 15m without heartbeat). Auto-recovered.'
          });
          db.addAuditLog('TASK_AUTO_HEALED', { taskId: task.id, previousStatus: 'running' });
          staleTasksHealed++;
        }
      }
    }

    // 2. Audit Runner Leases (> 60s without heartbeat)
    const runners = db.getRunnerLeases();
    const runnerTimeoutMs = 60 * 1000;

    for (const runner of runners) {
      if (runner.status === 'online') {
        const lastPing = new Date(runner.lastHeartbeat).getTime();
        if (now - lastPing > runnerTimeoutMs) {
          db.updateRunnerHeartbeat(runner.runnerId, runner.ip, runner.cpuUsage, runner.ramUsage);
          // Mark offline if still expired
          if (now - lastPing > runnerTimeoutMs * 2) {
            runner.status = 'offline';
            offlineRunnersDetected++;
            db.addAuditLog('RUNNER_OFFLINE_DETECTED', { runnerId: runner.runnerId });
          }
        }
      }
    }

    // 3. Audit LLM Circuit Breakers
    const states = LLMCircuitBreaker.getStates();
    for (const [provider, info] of Object.entries(states)) {
      if (info.state === 'OPEN') {
        // Test availability (it auto-transitions to HALF_OPEN after cooldown)
        if (LLMCircuitBreaker.isAvailable(provider)) {
          circuitsRecovered++;
        }
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
