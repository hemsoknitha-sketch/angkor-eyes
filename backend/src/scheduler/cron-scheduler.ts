import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { TurnCoordinator } from '../orchestrator/turn-coordinator.js';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  intervalMs?: number;
  prompt: string;
  roomId: string;
  targetAgentId?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
}

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  createdAt: string;
  deliveredAt?: string;
}

export class CronScheduler {
  private static scheduleFile = path.join(config.dataPath, 'schedules.json');
  private static outboxFile = path.join(config.dataPath, 'outbox_queue.json');

  private static jobs: ScheduledTask[] = [
    {
      id: 'job-daily-summary',
      name: 'Daily Executive Status & Test Regression Summary',
      cronExpression: '0 9 * * *',
      intervalMs: 24 * 60 * 60 * 1000,
      prompt: 'រៀបចំសេចក្តីសង្ខេបប្រតិបត្តិប្រចាំថ្ងៃ ពិនិត្យគុណភាព Test Suite និងស្ថានភាព AGI Agents ទាំងអស់។',
      roomId: 'room-main-squad',
      enabled: true,
      nextRun: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    }
  ];

  private static outbox: OutboxEventRecord[] = [];
  private static timer: NodeJS.Timeout | null = null;
  private static loaded = false;

  private static ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      fs.mkdirSync(config.dataPath, { recursive: true });
      if (fs.existsSync(this.scheduleFile)) {
        const parsed = JSON.parse(fs.readFileSync(this.scheduleFile, 'utf8'));
        if (Array.isArray(parsed) && parsed.length > 0) this.jobs = parsed;
      } else {
        this.persistSchedules();
      }
      if (fs.existsSync(this.outboxFile)) {
        const parsedOutbox = JSON.parse(fs.readFileSync(this.outboxFile, 'utf8'));
        if (Array.isArray(parsedOutbox)) this.outbox = parsedOutbox;
      }
    } catch (err) {
      console.warn('[CronScheduler] Persistence load warning:', err);
    }
  }

  private static persistSchedules(): void {
    try {
      fs.mkdirSync(path.dirname(this.scheduleFile), { recursive: true });
      fs.writeFileSync(this.scheduleFile, JSON.stringify(this.jobs, null, 2), 'utf8');
    } catch {
      // ignore write errors
    }
  }

  private static persistOutbox(): void {
    try {
      fs.mkdirSync(path.dirname(this.outboxFile), { recursive: true });
      fs.writeFileSync(this.outboxFile, JSON.stringify(this.outbox.slice(-200), null, 2), 'utf8');
    } catch {
      // ignore write errors
    }
  }

  public static enqueueOutboxEvent(eventType: string, payload: Record<string, any>): OutboxEventRecord {
    this.ensureLoaded();
    const rec: OutboxEventRecord = {
      id: `obx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      eventType,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString()
    };
    this.outbox.push(rec);
    this.persistOutbox();
    void this.flushOutbox();
    return rec;
  }

  public static async flushOutbox(): Promise<number> {
    this.ensureLoaded();
    let flushed = 0;
    for (const item of this.outbox) {
      if (item.status === 'delivered') continue;
      item.attempts += 1;
      try {
        db.addAuditLog(`OUTBOX_${item.eventType.toUpperCase()}`, {
          outboxId: item.id,
          attempts: item.attempts,
          payload: item.payload
        });
        item.status = 'delivered';
        item.deliveredAt = new Date().toISOString();
        flushed++;
      } catch {
        item.status = item.attempts >= 5 ? 'failed' : 'pending';
      }
    }
    if (flushed > 0) this.persistOutbox();
    return flushed;
  }

  public static getOutboxEvents(): OutboxEventRecord[] {
    this.ensureLoaded();
    return this.outbox;
  }

  public static initialize(): void {
    this.ensureLoaded();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      void this.checkDueJobs();
      void this.flushOutbox();
    }, 60000);
    this.timer.unref();
  }

  private static async checkDueJobs(): Promise<void> {
    this.ensureLoaded();
    const now = Date.now();
    for (const job of this.jobs) {
      if (!job.enabled) continue;
      if (now >= new Date(job.nextRun).getTime()) {
        job.lastRun = new Date().toISOString();
        job.nextRun = new Date(now + (job.intervalMs || 3600000)).toISOString();
        this.persistSchedules();
        this.enqueueOutboxEvent('scheduled_job_triggered', { jobId: job.id, name: job.name });

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
    this.ensureLoaded();
    const job: ScheduledTask = {
      ...params,
      id: `job-${Date.now()}`,
      nextRun: new Date(Date.now() + (params.intervalMs || 3600000)).toISOString()
    };
    this.jobs.push(job);
    this.persistSchedules();
    this.enqueueOutboxEvent('scheduled_job_created', { jobId: job.id, name: job.name });
    return job;
  }

  public static listJobs(): ScheduledTask[] {
    this.ensureLoaded();
    return this.jobs;
  }

  public static toggleJob(id: string): ScheduledTask | null {
    this.ensureLoaded();
    const job = this.jobs.find(j => j.id === id);
    if (!job) return null;
    job.enabled = !job.enabled;
    this.persistSchedules();
    this.enqueueOutboxEvent('scheduled_job_toggled', { id, enabled: job.enabled });
    return job;
  }

  public static deleteJob(id: string): boolean {
    this.ensureLoaded();
    const init = this.jobs.length;
    this.jobs = this.jobs.filter(j => j.id !== id);
    if (this.jobs.length !== init) {
      this.persistSchedules();
      return true;
    }
    return false;
  }
}
