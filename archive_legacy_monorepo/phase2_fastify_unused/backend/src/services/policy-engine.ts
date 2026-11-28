import { query } from '../lib/db';
import { classifyAction, actionFromName, type ActionKind, type RiskAssessment } from './risk-classifier';
import { logger } from '../lib/logger';

/**
 * Capability Permission System — enforced in the backend policy engine,
 * NEVER by the LLM. Capabilities live in the agent_capabilities table.
 *
 * Defaults: Lead creates tasks, no push. Dev reads/writes its worktree, no
 * merge to main. QA runs tests/reads, no edit of prod code. Reviewer reads/
 * reviews, no push/merge. Security scans, no deploy.
 */
export type AgentRole = 'lead' | 'dev' | 'qa' | 'reviewer' | 'security' | 'custom';

export const ROLE_CAPABILITIES: Record<AgentRole, ActionKind[]> = {
  lead: ['read', 'commit_branch', 'unit_test', 'lint'],
  dev: ['read', 'edit_worktree', 'unit_test', 'lint', 'commit_branch'],
  qa: ['read', 'unit_test', 'lint'],
  reviewer: ['read', 'lint'],
  security: ['read', 'unit_test', 'lint'],
  custom: ['read'],
};

export const ROLE_DENIED: Record<AgentRole, ActionKind[]> = {
  lead: ['push_main', 'merge_pr', 'deploy', 'delete_db', 'pay'],
  dev: ['push_main', 'merge_pr', 'deploy', 'delete_db', 'delete_files', 'pay'],
  qa: ['edit_worktree', 'push_main', 'merge_pr', 'deploy', 'delete_db', 'pay'],
  reviewer: ['edit_worktree', 'push_main', 'merge_pr', 'deploy', 'delete_db', 'pay'],
  security: ['edit_worktree', 'push_main', 'merge_pr', 'deploy', 'delete_db', 'pay'],
  custom: ['push_main', 'merge_pr', 'deploy', 'delete_db', 'pay', 'delete_files'],
};

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  risk: RiskAssessment;
  reason: string;
}

export async function getAgentCapabilities(agentId: string): Promise<{ role: AgentRole; allowed: ActionKind[]; denied: ActionKind[] }> {
  const res = await query<{ role: string; capabilities: string[] }>(
    `SELECT a.role, COALESCE(array_agg(ac.capability) FILTER (WHERE ac.capability IS NOT NULL), '{}') AS capabilities
     FROM agents a LEFT JOIN agent_capabilities ac ON ac.agent_id = a.id
     WHERE a.id = $1 GROUP BY a.role`,
    [agentId],
  );
  if (res.rows.length === 0) return { role: 'custom', allowed: ['read'], denied: ROLE_DENIED.custom };
  const role = (res.rows[0].role as AgentRole) ?? 'custom';
  const dbCaps = (res.rows[0].capabilities ?? []) as ActionKind[];
  const allowed = dbCaps.length > 0 ? dbCaps : ROLE_CAPABILITIES[role] ?? ['read'];
  return { role, allowed, denied: ROLE_DENIED[role] ?? [] };
}

/** The single choke point: every agent tool/action must pass through here. */
export async function checkPolicy(agentId: string, actionName: string, detail?: string): Promise<PolicyDecision> {
  const action = actionFromName(actionName);
  const risk = classifyAction(action, detail);
  const caps = await getAgentCapabilities(agentId);
  if (caps.denied.includes(action)) {
    logger.warn({ agentId, action }, 'policy denied action for role');
    return { allowed: false, requiresApproval: false, risk, reason: `role ${caps.role} may not perform ${action}` };
  }
  if (!caps.allowed.includes(action) && risk.risk === 'risky') {
    return { allowed: false, requiresApproval: false, risk, reason: `capability ${action} not granted to ${caps.role}` };
  }
  return { allowed: true, requiresApproval: risk.requiresApproval, risk, reason: risk.requiresApproval ? 'risky action requires approval' : 'safe action allowed' };
}
