import { query, withTx } from '../lib/db';
import { acquireLock, publish, roomLockKey, taskQueue, defaultJobOptions } from '../lib/redis';
import { ORCHESTRATOR } from '../config';
import { logger } from '../lib/logger';
import { checkPolicy } from './policy-engine';
import { sanitizeForLlm } from '../lib/prompt-injection';

export type AgentStatus = 'typing' | 'running_tests' | 'reviewing' | 'idle' | 'waiting_approval' | 'thinking';
export type TriggerSource = 'mention' | 'lead_plan' | 'schedule' | 'webhook' | 'user_message';

export interface IncomingTrigger {
  roomId: string;
  projectId: string;
  messageId?: string;
  text: string;
  mentionedAgentId?: string; // @mention wins over Lead planning
  telegramUserId: number;
  source: TriggerSource;
}

/**
 * Turn-Taking & Anti-Collision.
 * - @mention first: the named agent gets the turn.
 * - Otherwise the Lead creates an Execution Plan Queue (ordered agent turns).
 * - One agent runs per room at a time: Redis lock room_lock:<room_id>.
 * - Context chaining: each turn receives the previous turns' summaries.
 * - Loop guard: max_turns_per_trigger (6); stop early on QA PASS.
 */
export class TurnCoordinator {
  async handleTrigger(trigger: IncomingTrigger): Promise<{ queued: boolean; reason: string; planId?: string }> {
    const { text: safeText } = sanitizeForLlm(trigger.text);
    const release = await acquireLock(roomLockKey(trigger.roomId), ORCHESTRATOR.roomLockTtlMs);
    if (!release) {
      // Room busy — queue the trigger behind the running agent.
      await this.enqueueWaiting(trigger);
      await publish(`room:${trigger.roomId}:agent_queue`, { waiting: [trigger.mentionedAgentId ?? 'lead'] });
      return { queued: true, reason: 'room busy — trigger queued behind running agent' };
    }
    try {
      const context = await this.buildContextChain(trigger.roomId);
      let agentId = trigger.mentionedAgentId;
      let planId: string | undefined;
      if (!agentId) {
        // Lead creates the Execution Plan Queue.
        planId = await this.createExecutionPlan(trigger, context);
        agentId = await this.nextAgentFromPlan(planId);
      }
      if (!agentId) return { queued: false, reason: 'no agent available for trigger' };
      await this.broadcastStatus(trigger.roomId, agentId, 'thinking');
      await this.runTurn(trigger, agentId, safeText, context, planId);
      return { queued: false, reason: 'turn executed', planId };
    } finally {
      await release();
    }
  }

  private async enqueueWaiting(trigger: IncomingTrigger): Promise<void> {
    await query(
      `INSERT INTO messages (room_id, project_id, role, content, metadata)
       VALUES ($1,$2,'system',$3,$4)`,
      [trigger.roomId, trigger.projectId, `queued trigger: ${trigger.text.slice(0, 200)}`,
       JSON.stringify({ kind: 'queued_trigger', source: trigger.source, telegram_user_id: trigger.telegramUserId })],
    );
  }

  /** Context chaining: last N turns' summaries + recent messages, in order. */
  async buildContextChain(roomId: string, limit = 20): Promise<string> {
    const res = await query<{ role: string; content: string; created_at: string }>(
      `SELECT role, content, created_at FROM messages WHERE room_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [roomId, limit],
    );
    return res.rows.reverse().map((m) => `[${m.role}] ${m.content}`).join('\n');
  }

  private async createExecutionPlan(trigger: IncomingTrigger, context: string): Promise<string> {
    // The Lead's plan is a task row with a DAG; the DAG executor expands it.
    const res = await query<{ id: string }>(
      `INSERT INTO tasks (project_id, room_id, title, description, status, created_by)
       VALUES ($1,$2,$3,$4,'queued','lead') RETURNING id`,
      [trigger.projectId, trigger.roomId, `Plan: ${trigger.text.slice(0, 120)}`, context.slice(0, 4000)],
    );
    return res.rows[0].id;
  }

  private async nextAgentFromPlan(planId: string): Promise<string | undefined> {
    const res = await query<{ agent_id: string }>(
      `SELECT agent_id FROM tasks WHERE id=$1 AND agent_id IS NOT NULL`,
      [planId],
    );
    if (res.rows[0]?.agent_id) return res.rows[0].agent_id;
    const lead = await query<{ id: string }>(`SELECT id FROM agents WHERE role='lead' LIMIT 1`);
    return lead.rows[0]?.id;
  }

  async broadcastStatus(roomId: string, agentId: string, status: AgentStatus): Promise<void> {
    await publish(`room:${roomId}:agent_status`, { agent_id: agentId, status, at: new Date().toISOString() });
    await query(`UPDATE agents SET status=$2 WHERE id=$1`, [agentId, status]);
  }

  /** Run one turn with the loop guard; stop early on QA PASS. */
  private async runTurn(trigger: IncomingTrigger, agentId: string, text: string, context: string, planId?: string): Promise<void> {
    for (let turn = 1; turn <= ORCHESTRATOR.maxTurnsPerTrigger; turn++) {
      const decision = await checkPolicy(agentId, 'read', text);
      if (!decision.allowed) {
        logger.warn({ agentId, turn }, 'turn blocked by policy engine');
        break;
      }
      // The actual LLM call + tool execution happens in the runner (another
      // component); here we enqueue the turn as a durable job so a crash
      // does not lose it, and record the checkpoint.
      await taskQueue.add('agent-turn', {
        roomId: trigger.roomId, projectId: trigger.projectId, agentId,
        text, context, turn, planId, triggerSource: trigger.source,
      }, { ...defaultJobOptions, jobId: `turn:${trigger.roomId}:${trigger.messageId ?? Date.now()}:${turn}` });
      const qaPass = await this.checkQaPass(trigger.roomId);
      if (qaPass) {
        logger.info({ roomId: trigger.roomId, turn }, 'QA PASS — stopping turn loop');
        break;
      }
      if (turn === ORCHESTRATOR.maxTurnsPerTrigger) {
        logger.warn({ roomId: trigger.roomId }, 'loop guard hit max_turns_per_trigger');
      }
    }
  }

  private async checkQaPass(roomId: string): Promise<boolean> {
    const res = await query<{ status: string }>(
      `SELECT status FROM tasks WHERE room_id=$1 AND title LIKE '%QA%' ORDER BY updated_at DESC LIMIT 1`,
      [roomId],
    );
    return res.rows[0]?.status === 'completed';
  }
}

export const turnCoordinator = new TurnCoordinator();
