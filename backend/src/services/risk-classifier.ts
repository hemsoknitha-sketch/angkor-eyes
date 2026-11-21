/**
 * Risk classifier — Safe vs Risky. This is code, not an LLM judgement:
 * the policy engine enforces the result. The LLM may *suggest* a risk level,
 * but this classifier is the authority for the approval gate.
 */
export type RiskLevel = 'safe' | 'risky';
export type ActionKind =
  | 'read' | 'edit_worktree' | 'unit_test' | 'lint' | 'commit_branch'
  | 'push_main' | 'merge_pr' | 'delete_files' | 'delete_db' | 'deploy'
  | 'pay' | 'email_external' | 'message_external' | 'run_migrations' | 'unknown';

const SAFE_ACTIONS = new Set<ActionKind>(['read', 'edit_worktree', 'unit_test', 'lint', 'commit_branch']);
const RISKY_ACTIONS = new Set<ActionKind>([
  'push_main', 'merge_pr', 'delete_files', 'delete_db', 'deploy',
  'pay', 'email_external', 'message_external', 'run_migrations',
]);

export interface RiskAssessment {
  action: ActionKind;
  risk: RiskLevel;
  reasons: string[];
  requiresApproval: boolean;
}

export function classifyAction(action: ActionKind, detail?: string): RiskAssessment {
  const reasons: string[] = [];
  if (RISKY_ACTIONS.has(action)) reasons.push(`action ${action} affects shared/production state`);
  if (SAFE_ACTIONS.has(action)) reasons.push(`action ${action} is scoped to the agent's own worktree`);
  if (action === 'unknown') reasons.push('unrecognised action — default to risky');
  if (detail && /main|master|production|prod|billing|payment/i.test(detail)) {
    reasons.push('target mentions production/main/billing');
  }
  const risk: RiskLevel = SAFE_ACTIONS.has(action) && reasons.every((r) => !r.includes('production'))
    ? 'safe' : 'risky';
  return { action, risk, reasons, requiresApproval: risk === 'risky' };
}

/** Map a free-text tool/action name to a canonical ActionKind. */
export function actionFromName(name: string): ActionKind {
  const n = name.toLowerCase();
  if (n.includes('push') && n.includes('main')) return 'push_main';
  if (n.includes('merge')) return 'merge_pr';
  if (n.includes('delete') && n.includes('db')) return 'delete_db';
  if (n.includes('delete') || n.includes('rm ')) return 'delete_files';
  if (n.includes('deploy')) return 'deploy';
  if (n.includes('pay') || n.includes('charge') || n.includes('stripe')) return 'pay';
  if (n.includes('email') || n.includes('send')) return 'email_external';
  if (n.includes('migrat')) return 'run_migrations';
  if (n.includes('test')) return 'unit_test';
  if (n.includes('lint')) return 'lint';
  if (n.includes('commit')) return 'commit_branch';
  if (n.includes('read') || n.includes('get') || n.includes('list')) return 'read';
  if (n.includes('write') || n.includes('edit')) return 'edit_worktree';
  return 'unknown';
}
