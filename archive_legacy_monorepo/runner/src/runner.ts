/**
 * runner.ts — Runner daemon core (ANGKOR EYES).
 * - Outbound WSS only (no open port). Token auth via RUNNER_TOKEN.
 * - Heartbeat every 30s; lease timeout: if no heartbeat ACK within
 *   LEASE_TIMEOUT_MS, stop claiming new tasks and finish/abandon current one.
 * - Task polling/claim over WSS; checkpoints saved to disk so a restart
 *   resumes (Checkpoint/Resume).
 * - Exponential backoff on reconnect / claim failures (1s -> 60s cap).
 * - Cancellation: backend `task.cancel` aborts the running executor.
 * - Safe vs risky gating: risky actions are NEVER executed locally without
 *   an approved approval_id + action_hash (see executor.ts).
 */
import * as fs from "fs";
import * as path from "path";
import WebSocket from "ws";
import { AuditLog } from "./audit";
import { Redactor } from "./redaction";
import { WorktreeManager } from "./worktree";

export interface RunnerConfig {
  backendWssUrl: string;   // e.g. wss://backend.example.com/runner (env BACKEND_WSS_URL)
  token: string;           // env RUNNER_TOKEN — never hardcode, never log
  runnerId: string;
  repoPath: string;
  heartbeatMs?: number;
  leaseTimeoutMs?: number;
}

export interface Task {
  id: string; project: string; agent_role: string;
  title: string; instructions: string;
  risk?: "low" | "medium" | "high";
  approval_id?: string; action_hash?: string;
  checkpoint?: { step: string; state: Record<string, unknown> };
}

export interface Checkpoint { taskId: string; step: string; state: Record<string, unknown>; updatedAt: string; }

const HEARTBEAT_MS = 30_000;
const LEASE_TIMEOUT_MS = 90_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

export function backoffDelay(attempt: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
}

export class Runner {
  private ws: WebSocket | null = null;
  private audit: AuditLog;
  private redactor = new Redactor();
  private worktrees: WorktreeManager;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastHeartbeatAck = Date.now();
  private currentTask: Task | null = null;
  private cancelled = new Set<string>();
  private reconnectAttempt = 0;
  private stopped = false;
  private checkpointDir: string;

  constructor(private cfg: RunnerConfig) {
    this.audit = new AuditLog({ runnerId: cfg.runnerId, forward: (e) => this.send({ type: "audit", event: e }) });
    this.worktrees = new WorktreeManager(cfg.repoPath);
    this.checkpointDir = path.join(cfg.repoPath, ".angkor-eyes", "checkpoints");
    fs.mkdirSync(this.checkpointDir, { recursive: true });
  }

  // ---- Checkpoint / Resume ----
  saveCheckpoint(taskId: string, step: string, state: Record<string, unknown>): void {
    const cp: Checkpoint = { taskId, step, state, updatedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(this.checkpointDir, `${taskId}.json`), JSON.stringify(cp, null, 2));
    this.audit.emit("task.checkpoint", { task_id: taskId, step }, { taskId, runnerId: this.cfg.runnerId });
  }
  loadCheckpoint(taskId: string): Checkpoint | null {
    try { return JSON.parse(fs.readFileSync(path.join(this.checkpointDir, `${taskId}.json`), "utf8")) as Checkpoint; }
    catch { return null; }
  }
  resumePendingCheckpoints(): Checkpoint[] {
    return fs.readdirSync(this.checkpointDir).filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(this.checkpointDir, f), "utf8")) as Checkpoint);
  }

  cancelTask(taskId: string): void {
    this.cancelled.add(taskId);
    this.audit.emit("task.cancelled", { task_id: taskId }, { taskId, runnerId: this.cfg.runnerId });
  }
  isCancelled(taskId: string): boolean { return this.cancelled.has(taskId); }

  // ---- WSS transport (outbound only, no listening socket) ----
  connect(): void {
    const ws = new WebSocket(this.cfg.backendWssUrl, {
      headers: { Authorization: `Bearer ${this.cfg.token}` },
    });
    this.ws = ws;
    ws.on("open", () => {
      this.reconnectAttempt = 0;
      this.lastHeartbeatAck = Date.now();
      this.send({ type: "hello", runner_id: this.cfg.runnerId, capabilities: ["worktree", "sandbox", "tests"] });
      this.audit.emit("runner.start", { backend: this.redactor.redact(this.cfg.backendWssUrl) }, { runnerId: this.cfg.runnerId });
      // Resume any checkpointed tasks after reconnect.
      for (const cp of this.resumePendingCheckpoints()) {
        this.send({ type: "task.resume", task_id: cp.taskId, checkpoint: cp });
      }
      this.startHeartbeat();
    });
    ws.on("message", (data) => this.onMessage(JSON.parse(data.toString()) as Record<string, unknown>));
    ws.on("close", () => this.scheduleReconnect());
    ws.on("error", () => { /* close handler reconnects */ });
  }

  private onMessage(msg: Record<string, unknown>): void {
    if (msg.type === "heartbeat.ack") { this.lastHeartbeatAck = Date.now(); return; }
    if (msg.type === "task.assign") {
      const task = msg.task as Task;
      // Redact instructions before any local log that could reach an LLM.
      task.instructions = this.redactor.redact(task.instructions);
      void this.claimTask(task);
      return;
    }
    if (msg.type === "task.cancel") { this.cancelTask(String(msg.task_id)); return; }
  }

  private async claimTask(task: Task): Promise<void> {
    if (Date.now() - this.lastHeartbeatAck > (this.cfg.leaseTimeoutMs ?? LEASE_TIMEOUT_MS)) {
      this.send({ type: "task.decline", task_id: task.id, reason: "lease expired — heartbeat ACK stale" });
      return;
    }
    this.currentTask = task;
    this.audit.emit("task.claimed", { task_id: task.id, role: task.agent_role }, { taskId: task.id, agentRole: task.agent_role, runnerId: this.cfg.runnerId });
    try {
      const wt = await this.worktrees.create(task.project, task.agent_role, task.id);
      this.saveCheckpoint(task.id, "worktree_created", { worktree_path: wt.path, branch: wt.branch, head_sha: wt.headSha });
      this.send({ type: "task.claimed", task_id: task.id, worktree: wt });
    } catch (err) {
      this.send({ type: "task.failed", task_id: task.id, error: String(err) });
      this.audit.emit("task.failed", { task_id: task.id, error: String(err) }, { taskId: task.id, runnerId: this.cfg.runnerId });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastHeartbeatAck > (this.cfg.leaseTimeoutMs ?? LEASE_TIMEOUT_MS)) {
        // Lease lost: stop claiming; do not start new work.
        this.audit.emit("runner.heartbeat", { status: "lease_lost" }, { runnerId: this.cfg.runnerId });
        return;
      }
      this.send({ type: "heartbeat", runner_id: this.cfg.runnerId, ts: new Date().toISOString(), current_task: this.currentTask?.id ?? null });
    }, this.cfg.heartbeatMs ?? HEARTBEAT_MS);
  }
  private stopHeartbeat(): void { if (this.heartbeatTimer) clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }

  private scheduleReconnect(): void {
    this.stopHeartbeat();
    if (this.stopped) return;
    const delay = backoffDelay(this.reconnectAttempt++);
    setTimeout(() => this.connect(), delay);
  }

  send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  stop(): void {
    this.stopped = true;
    this.stopHeartbeat();
    this.ws?.close();
    this.audit.emit("runner.stop", {}, { runnerId: this.cfg.runnerId });
  }
}
