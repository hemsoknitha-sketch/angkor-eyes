/**
 * audit.ts — Local audit log emitter (ANGKOR EYES runner).
 * Append-only JSONL log. Every security-relevant event is recorded locally
 * AND forwarded to the backend over the WSS control channel when connected.
 * Never log secret values: callers must redact first (see redaction.ts).
 */
import * as fs from "fs";
import * as path from "path";

export type AuditEventType =
  | "runner.start" | "runner.stop" | "runner.heartbeat"
  | "task.claimed" | "task.completed" | "task.failed" | "task.cancelled"
  | "task.checkpoint" | "task.resumed"
  | "worktree.created" | "worktree.removed"
  | "exec.started" | "exec.completed" | "exec.blocked" | "exec.timeout"
  | "approval.requested" | "approval.verified" | "approval.rejected"
  | "git.push" | "git.merge" | "git.rollback"
  | "sandbox.started" | "sandbox.stopped"
  | "secret.injected" | "secret.redacted"
  | "security.violation";

export interface AuditEvent {
  ts: string; // ISO 8601 UTC
  runner_id: string;
  type: AuditEventType;
  task_id?: string;
  agent_role?: string;
  detail: Record<string, unknown>;
}

export class AuditLog {
  private file: string;
  private forward: (event: AuditEvent) => void;

  constructor(opts: { logDir?: string; runnerId: string; forward?: (e: AuditEvent) => void }) {
    const dir = opts.logDir ?? path.join(process.cwd(), "logs");
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, "audit.jsonl");
    this.forward = opts.forward ?? (() => {});
  }

  emit(type: AuditEventType, detail: Record<string, unknown>, ctx: { taskId?: string; agentRole?: string; runnerId: string }): void {
    const event: AuditEvent = {
      ts: new Date().toISOString(),
      runner_id: ctx.runnerId,
      type,
      task_id: ctx.taskId,
      agent_role: ctx.agentRole,
      detail,
    };
    fs.appendFileSync(this.file, JSON.stringify(event) + "\n", "utf8");
    try { this.forward(event); } catch { /* forwarding must never break local logging */ }
  }

  get path(): string { return this.file; }
}
