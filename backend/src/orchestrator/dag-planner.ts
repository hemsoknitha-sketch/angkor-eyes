import { randomUUID as uuidv4 } from 'node:crypto';
import type { DAGNode, Task, AgentRole } from '../db/schema.js';
import { db } from '../db/index.js';

export class DAGPlanner {
  /**
   * Automatically decompose a user request into a dynamic DAG workflow.
   */
  public static createDefaultTaskDAG(params: {
    projectId: string;
    roomId: string;
    leadAgentId: string;
    userRequest: string;
  }): Task {
    const isPerformanceOrBugfix = /(?:fast|slow|fix|bug|optimize|crash|error|លឿន|យឺត|ជួសជុល|កែកំហុស)/i.test(params.userRequest);
    const isNewFeature = /(?:feature|add|create|build|បង្កើត|បន្ថែម|ថ្មី)/i.test(params.userRequest);

    const nodes: DAGNode[] = [];

    // Node 1: Dev implementation
    const devNodeId = `node-${uuidv4().substring(0, 6)}`;
    nodes.push({
      id: devNodeId,
      agentRole: 'developer',
      title: isPerformanceOrBugfix ? 'Code Optimization & Implementation' : 'Feature Implementation in Worktree',
      description: `Implement required changes for: "${params.userRequest.substring(0, 100)}" in isolated worktree.`,
      status: 'pending',
      dependencies: []
    });

    // Node 2: QA testing
    const qaNodeId = `node-${uuidv4().substring(0, 6)}`;
    nodes.push({
      id: qaNodeId,
      agentRole: 'qa',
      title: 'Automated Test Suite & Regression Verification',
      description: 'Run unit & integration tests, assert performance, ensure zero regressions.',
      status: 'pending',
      dependencies: [devNodeId]
    });

    // Node 3: Code Review & Security Audit
    const reviewerNodeId = `node-${uuidv4().substring(0, 6)}`;
    nodes.push({
      id: reviewerNodeId,
      agentRole: 'reviewer',
      title: 'Code Review, Security Scan & Diff Validation',
      description: 'Verify diff security, check coding standards, submit approval request if safe.',
      status: 'pending',
      dependencies: [qaNodeId]
    });

    const task = db.createTask({
      projectId: params.projectId,
      roomId: params.roomId,
      leadAgentId: params.leadAgentId,
      title: `Task: ${params.userRequest.substring(0, 60)}...`,
      description: params.userRequest,
      status: 'pending',
      dag: nodes,
      currentStep: 0,
      retryCount: 0,
      maxRetries: 3
    });

    db.addAuditLog('TASK_DAG_CREATED', {
      taskId: task.id,
      nodeCount: nodes.length,
      leadAgentId: params.leadAgentId
    }, params.leadAgentId);

    return task;
  }
}
