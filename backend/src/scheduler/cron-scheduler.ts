import { db } from '../db/index.js';
import { TurnCoordinator } from '../orchestrator/turn-coordinator.js';
import { TelegramBotEngine } from '../bot/telegram-bot.js';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string; // e.g. "0 9 * * *"
  intervalMs?: number;    // or simple periodic interval
  prompt: string;
  roomId: string;
  targetAgentId?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
}

export class CronScheduler {
  private static jobs: ScheduledTask[] = [
    {
      id: 'job-daily-summary',
      name: 'Daily 9:00 AM Executive Status & Test Regression Summary',
      cronExpression: '0 9 * * *',
      intervalMs: 24 * 60 * 60 * 1000,
      prompt: 'រៀបចំសេចក្តីសង្ខេបប្រតិបត្តិប្រចាំថ្ងៃ ពិនិត្យគុណភាព Test Suite និងស្ថានភាព AGI Agents ទាំងអស់។',
      roomId: 'room-main-squad',
      enabled: true,
      nextRun: new Date(Date.now() + 3600000).toISOString()
    }
  ];

  private static timer: NodeJS.Timeout | null = null;

  public static initialize(): void {
    if (this.timer) clearInterval(this.timer);

    console.log('[CronScheduler] Initializing automated background scheduler.');
    this.timer = setInterval(() => {
      this.checkDueJobs();
    }, 60000); // Check every minute
  }

  private static async checkDueJobs(): Promise<void> {
    const now = Date.now();
    for (const job of this.jobs) {
      if (!job.enabled) continue;
      const nextTime = new Date(job.nextRun).getTime();

      if (now >= nextTime) {
        console.log(`[CronScheduler] Triggering scheduled job: ${job.name}`);
        job.lastRun = new Date().toISOString();
        job.nextRun = new Date(now + (job.intervalMs || 3600000)).toISOString();

        db.addAuditLog('SCHEDULED_JOB_TRIGGERED', { jobId: job.id, name: job.name });

        try {
          await TurnCoordinator.handleMessage({
            roomId: job.roomId,
            senderType: 'system',
            senderId: 'scheduler',
            senderName: 'ANGKOR EYES Cron Scheduler',
            content: `⏰ **Scheduled Automation: ${job.name}**\n${job.prompt}`
          });
        } catch (err: any) {
          console.error(`[CronScheduler] Error executing job ${job.id}:`, err.message);
        }
      }
    }
  }

  public static addJob(params: Omit<ScheduledTask, 'id' | 'nextRun' | 'lastRun'>): ScheduledTask {
    const job: ScheduledTask = {
      ...params,
      id: `job-${Date.now()}`,
      nextRun: new Date(Date.now() + (params.intervalMs || 3600000)).toISOString()
    };
    this.jobs.push(job);
    db.addAuditLog('SCHEDULED_JOB_CREATED', { job });
    return job;
  }

  public static listJobs(): ScheduledTask[] {
    return this.jobs;
  }

  public static toggleJob(id: string): ScheduledTask | null {
    const job = this.jobs.find(j => j.id === id);
    if (!job) return null;
    job.enabled = !job.enabled;
    db.addAuditLog('SCHEDULED_JOB_TOGGLED', { id, enabled: job.enabled });
    return job;
  }

  public static deleteJob(id: string): boolean {
    const init = this.jobs.length;
    this.jobs = this.jobs.filter(j => j.id !== id);
    return this.jobs.length !== init;
  }
}
