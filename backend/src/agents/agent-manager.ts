import { db } from '../db/index.js';
import type { Agent, AgentRole, AgentCapability } from '../db/schema.js';
import { DEFAULT_ROLE_CAPABILITIES } from './capability-matrix.js';
import { AGENT_PRESETS } from './presets.js';

export class AgentManager {
  public static listAgents(projectId?: string): Agent[] {
    return db.getAgents(projectId);
  }

  public static getAgent(id: string): Agent | undefined {
    return db.getAgentById(id);
  }

  public static createAgentFromPreset(params: {
    userId: string;
    projectId: string;
    presetId: string;
    customName?: string;
    customModel?: string;
  }): Agent {
    const preset = AGENT_PRESETS.find(p => p.id === params.presetId) || AGENT_PRESETS[1];
    return db.createAgent({
      userId: params.userId,
      projectId: params.projectId,
      name: params.customName || preset.name,
      role: preset.role,
      systemPrompt: preset.systemPrompt,
      model: params.customModel || preset.model,
      isLead: preset.role === 'lead',
      status: 'active',
      capabilities: preset.capabilities,
      avatarColor: preset.avatarColor
    });
  }

  public static createAgent(params: {
    userId: string;
    projectId: string;
    name: string;
    role: AgentRole;
    systemPrompt: string;
    model: string;
    isLead?: boolean;
    capabilities?: Partial<AgentCapability>;
    avatarColor?: string;
  }): Agent {
    const defaultCaps = DEFAULT_ROLE_CAPABILITIES[params.role] || DEFAULT_ROLE_CAPABILITIES.custom;
    const finalCaps: AgentCapability = { ...defaultCaps, ...(params.capabilities || {}) };

    const agent = db.createAgent({
      userId: params.userId,
      projectId: params.projectId,
      name: params.name,
      role: params.role,
      systemPrompt: params.systemPrompt,
      model: params.model,
      isLead: !!params.isLead,
      status: 'active',
      capabilities: finalCaps,
      avatarColor: params.avatarColor || '#3b82f6'
    });

    db.addAuditLog('AGENT_CREATED', { agentId: agent.id, name: agent.name, role: agent.role }, agent.id, params.userId);
    return agent;
  }

  public static updateAgent(id: string, updates: Partial<Agent>): Agent | null {
    const updated = db.updateAgent(id, updates);
    if (updated) {
      db.addAuditLog('AGENT_UPDATED', { agentId: id, updates }, id);
    }
    return updated;
  }

  public static cloneAgent(id: string, newName?: string): Agent | null {
    const original = db.getAgentById(id);
    if (!original) return null;

    const cloned = db.createAgent({
      userId: original.userId,
      projectId: original.projectId,
      name: newName || `${original.name} (Copy)`,
      role: original.role,
      systemPrompt: original.systemPrompt,
      model: original.model,
      isLead: false, // cloned agent cannot be lead automatically
      status: 'active',
      capabilities: { ...original.capabilities },
      avatarColor: original.avatarColor
    });

    db.addAuditLog('AGENT_CLONED', { originalId: id, newId: cloned.id, name: cloned.name }, cloned.id);
    return cloned;
  }

  public static togglePauseAgent(id: string): Agent | null {
    const agent = db.getAgentById(id);
    if (!agent) return null;
    const newStatus = agent.status === 'paused' ? 'active' : 'paused';
    return this.updateAgent(id, { status: newStatus });
  }

  public static deleteAgent(id: string): boolean {
    const agent = db.getAgentById(id);
    if (!agent) return false;
    if (agent.isLead) {
      throw new Error('Cannot delete the Lead Agent. Reassign lead role first.');
    }
    const success = db.deleteAgent(id);
    if (success) {
      db.addAuditLog('AGENT_DELETED', { agentId: id, name: agent.name }, id);
    }
    return success;
  }
}
