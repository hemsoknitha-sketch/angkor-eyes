import { query, withTx } from '../lib/db';
import { taskQueue, defaultJobOptions } from '../lib/redis';
import { logger } from '../lib/logger';
import { ORCHESTRATOR } from '../config';
import { recordUsage } from './usage-tracker';
import { writeOutbox } from './outbox';

export type TaskStatus = 'queued' | 'running' | 'waiting_approval' | 'paused' | 'failed' | 'completed' | 'cancelled';

export interface DagNode {
  id: string;
  taskId: string;
  agentRole: string;
  title: string;
  dependsOn: string[]; // node ids that must complete first
  status: TaskStatus;
}

export interface DagDefinition {
  projectId: string;
  roomId: string;
  title: string;
  /** Ordered stages; nodes in one stage run in parallel (fan-out), next stage waits (fan-in). */
  stages: Array<Array<{ agentRole: string; title: string; description?: string }>>;
}

/**
 * Dynamic Task DAG executor — not only sequential.
 * Default shape: [Frontend + Backend in parallel] -> Integration -> Reviewer -> QA -> Lead final report.
 * Nodes are durable rows in `tasks` (Postgres = source of truth); the queue
 * only carries the work. Fan-out enqueues ready nodes; fan-in waits for all
 * dependencies to be `completed` before the next stage starts.
 */
export class TaskDag {
  /** Create the DAG as durable task rows and enqueue the first stage. */
  async createDag(def: DagDefinition): Promise<{ dagId: string; nodeIds: string[] }> {
    const nodeIds: string[] = [];
    const dagId = crypto.randomUUID();
    await withTx(async (client) => {
      for (let stage = 0; stage < def.stages.length; stage++) {
        for (const node of def.stages[stage]) {
          const agent = await client.query<{ id: string }>(
            `SELECT id FROM agents WHERE role=$1 AND project_id=$2 LIMIT 1`, [node.agentRole, def.projectId],
          );
          const res = await client.query<{ id: string }>(
            `INSERT INTO tasks (project_id, room_id, title, description, status, agent_id, metadata)
             VALUES ($1,$2,$3,$4,'queued',$5,$6) RETURNING id`,
            [def.projectId, def.roomId, node.title, node.description ?? '', agent.rows[0]?.id ?? null,
             JSON.stringify({ dag_id: dagId, stage, agent_role: node.agentRole })],
          );
          nodeIds.push(res.rows[0].id);
        }
      }
    });
    // Fan-out: enqueue stage 0 (no dependencies).
    await this.enqueueReadyNodes(dagId);
    return { dagId, nodeIds };
  }

  /** Standard project DAG: Frontend+Backend parallel, then Integration, Reviewer, QA, Lead report. */
  async createStandardDag(projectId: string, roomId: string, title: string): Promise<{ dagId: string; nodeIds: string[] }> {
    return this.createDag({
      projectId, roomId, title,
      stages: [
        [
          { agentRole: 'dev', title: 'Frontend implementation', description: 'Build UI in the frontend worktree' },
          { agentRole: 'dev', title: 'Backend implementation', description: 'Build API in the backend worktree' },
        ],
        [{ agentRole: 'dev', title: 'Integration', description: 'Wire frontend to backend, resolve conflicts' }],
        [{ agentRole: 'reviewer', title: 'Code review', description: 'Review diff, security and style' }],
        [{ agentRole: 'qa', title: 'QA — tests', description: 'Run test suite, report failures' }],
        [{ agentRole: 'lead', title: 'Final report', description: 'Lead summarises outcome for the user' }],
      ],
    });
  }

  /** Enqueue every queued node whose dependencies are all completed. */
  async enqueueReadyNodes(dagId: string): Promise<string[]> {
    const nodes = await query<{ id: string; metadata: { stage: number } }>(
      `SELECT id, metadata FROM tasks WHERE metadata->>'dag_id'=$1 AND status='queued' ORDER BY (metadata->>'stage')::int`,
      [dagId],
    );
    const enqueued: string[] = [];
    for (const node of nodes.rows) {
      const stage = node.metadata?.stage ?? 0;
      if (stage === 0) {
        await this.enqueueNode(node.id);
        enqueued.push(node.id);
        continue;
      }
      const depsDone = await this.stageComplete(dagId, stage - 1);
      if (depsDone) { await this.enqueueNode(node.id); enqueued.push(node.id); }
    }
    return enqueued;
  }

  private async stageComplete(dagId: string, stage: number): Promise<boolean> {
    const res = await query<{ total: string; done: string }>(
      `SELECT count(*) AS total, count(*) FILTER (WHERE status='completed') AS done
       FROM tasks WHERE metadata->>'dag_id'=$1 AND (metadata->>'stage')::int=$2`,
      [dagId, stage],
    );
    const total = Number(res.rows[0]?.total ?? 0);
    return total > 0 && Number(res.rows[0]?.done ?? 0) === total;
  }

  private async enqueueNode(taskId: string): Promise<void> {
    await taskQueue.add('dag-node', { taskId }, { ...defaultJobOptions, jobId: `dag-node:${taskId}` });
  }

  /** Transition a task, with checkpoint + outbox in the same transaction. */
  async transition(taskId: string, to: TaskStatus, detail?: string): Promise<void> {
    await withTx(async (client) => {
      const res = await client.query<{ status: TaskStatus; metadata: Record<string, unknown> }>(
        `SELECT status, metadata FROM tasks WHERE id=$1 FOR UPDATE`, [taskId],
      );
      if (res.rows.length === 0) throw new Error(`task-not-found:${taskId}`);
      const from = res.rows[0].status;
      // Terminal states are final.
      if ((from === 'completed' || from === 'cancelled') && to !== from) {
        throw new Error(`illegal-transition:${from}->${to}`);
      }
      await client.query(
        `UPDATE tasks SET status=$2, updated_at=now() WHERE id=$1`, [taskId, to],
      );
      await client.query(
        `INSERT INTO task_checkpoints (task_id, status, detail, state) VALUES ($1,$2,$3,$4)`,
        [taskId, to, detail ?? `${from} -> ${to}`, JSON.stringify({ from, to, at: new Date().toISOString() })],
      );
    });
    const dagId = await this.dagIdOf(taskId);
    if (to === 'completed' && dagId) await this.enqueueReadyNodes(dagId);
    if (to === 'failed' && dagId) await this.handleFailure(taskId, dagId);
    await writeOutbox('task.status_changed', { task_id: taskId, status: to });
    logger.info({ taskId, to }, 'task transitioned');
  }

  private async dagIdOf(taskId: string): Promise<string | null> {
    const res = await query<{ dag_id: string }>(
      `SELECT metadata->>'dag_id' AS dag_id FROM tasks WHERE id=$1`, [taskId],
    );
    return res.rows[0]?.dag_id ?? null;
  }

  /** Exponential-backoff retry; after max attempts the node goes to the Dead Letter Queue. */
  private async handleFailure(taskId: string, dagId: string): Promise<void> {
    const res = await query<{ retry_count: number }>(
      `SELECT retry_count FROM tasks WHERE id=$1`, [taskId],
    );
    const retries = res.rows[0]?.retry_count ?? 0;
    if (retries < ORCHESTRATOR.retryMaxAttempts) {
      const delayMs = ORCHESTRATOR.retryBaseDelayMs * 2 ** retries;
      await query(`UPDATE tasks SET retry_count=retry_count+1, status='queued' WHERE id=$1`, [taskId]);
      await taskQueue.add('dag-node', { taskId }, { ...defaultJobOptions, delay: delayMs, jobId: `dag-retry:${taskId}:${retries}` });
      logger.info({ taskId, delayMs }, 'task scheduled for retry with exponential backoff');
    } else {
      await query(`INSERT INTO dead_letter_queue (task_id, reason) VALUES ($1,'max retries exceeded')`, [taskId]);
      await writeOutbox('task.dead_letter', { task_id: taskId, dag_id: dagId });
      logger.error({ taskId, dagId }, 'task moved to dead letter queue');
    }
  }

  /** Resume from the latest checkpoint (manual recovery / crash recovery). */
  async resume(taskId: string): Promise<{ checkpointId: string; status: TaskStatus } | null> {
    const res = await query<{ id: string; status: TaskStatus }>(
      `SELECT id, status FROM task_checkpoints WHERE task_id=$1 ORDER BY created_at DESC LIMIT 1`, [taskId],
    );
    if (res.rows.length === 0) return null;
    const cp = res.rows[0];
    if (cp.status === 'running' || cp.status === 'queued') {
      await this.transition(taskId, 'queued', `resumed from checkpoint ${cp.id}`);
      await this.enqueueNode(taskId);
    }
    return { checkpointId: cp.id, status: cp.status };
  }

  async cancel(taskId: string, reason = 'cancelled by user'): Promise<void> {
    await this.transition(taskId, 'cancelled', reason);
  }

  async pause(taskId: string): Promise<void> {
    await this.transition(taskId, 'paused', 'paused by user');
  }
}

export const taskDag = new TaskDag();
export { recordUsage };
