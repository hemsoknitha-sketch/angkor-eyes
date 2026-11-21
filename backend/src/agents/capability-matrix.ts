import type { AgentRole, AgentCapability } from '../db/schema.js';
import { db } from '../db/index.js';

export const DEFAULT_ROLE_CAPABILITIES: Record<AgentRole, AgentCapability> = {
  lead: {
    canPlanAndDelegate: true,
    canReadFiles: true,
    canWriteFiles: false,
    canRunTests: false,
    canCommitBranch: false,
    canMergeMain: false,
    canPushRemote: false,
    canDeploy: false
  },
  developer: {
    canPlanAndDelegate: false,
    canReadFiles: true,
    canWriteFiles: true,
    canRunTests: true,
    canCommitBranch: true,
    canMergeMain: false,
    canPushRemote: false,
    canDeploy: false
  },
  qa: {
    canPlanAndDelegate: false,
    canReadFiles: true,
    canWriteFiles: false,
    canRunTests: true,
    canCommitBranch: false,
    canMergeMain: false,
    canPushRemote: false,
    canDeploy: false
  },
  reviewer: {
    canPlanAndDelegate: false,
    canReadFiles: true,
    canWriteFiles: false,
    canRunTests: true,
    canCommitBranch: false,
    canMergeMain: false,
    canPushRemote: false,
    canDeploy: false
  },
  security: {
    canPlanAndDelegate: false,
    canReadFiles: true,
    canWriteFiles: false,
    canRunTests: true,
    canCommitBranch: false,
    canMergeMain: false,
    canPushRemote: false,
    canDeploy: false
  },
  custom: {
    canPlanAndDelegate: false,
    canReadFiles: true,
    canWriteFiles: true,
    canRunTests: true,
    canCommitBranch: false,
    canMergeMain: false,
    canPushRemote: false,
    canDeploy: false
  }
};

export class CapabilityMatrix {
  public static verifyPermission(agentId: string, action: keyof AgentCapability): {
    allowed: boolean;
    reason?: string;
  } {
    const agent = db.getAgentById(agentId);
    if (!agent) {
      return { allowed: false, reason: `Agent ${agentId} not found.` };
    }
    if (agent.status === 'paused') {
      return { allowed: false, reason: `Agent ${agent.name} is currently paused.` };
    }

    const hasCapability = agent.capabilities[action];
    if (!hasCapability) {
      return {
        allowed: false,
        reason: `Role '${agent.role}' for Agent ${agent.name} is not permitted to perform action '${action}'.`
      };
    }

    return { allowed: true };
  }
}
