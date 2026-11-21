/**
 * Unit tests — Risk Classifier + Approval Gate contract.
 *
 * SELF-CONTAINED: the classifier is implemented inline as the contract
 * the backend builder must satisfy (see docs/architecture.md §4).
 * These tests do NOT import backend/ or any other builder's code.
 * When the real RiskClassifier exists, move this logic behind an import
 * and keep the test cases unchanged — they are the spec.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Inline contract implementation (mirror of docs/architecture.md §4)
// ---------------------------------------------------------------------------

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  /** Optional LLM second-opinion risk (if present and higher, it wins). */
  llmOpinion?: RiskLevel;
}

const RISK_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
const higher = (a: RiskLevel, b: RiskLevel): RiskLevel =>
  RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;

/** Deterministic rules layer: tool + argument patterns. */
export function classifyRisk(call: ToolCall): RiskLevel {
  const { tool, args } = call;
  let risk: RiskLevel = 'low';

  switch (tool) {
    case 'read_file':
    case 'list_files':
    case 'web_search':
    case 'summarise':
    case 'list_tasks':
      risk = 'low';
      break;
    case 'edit_file':
    case 'install_dependency':
    case 'send_draft_message':
      risk = 'medium';
      break;
    case 'merge_worktree':
    case 'deploy':
    case 'run_shell':
    case 'send_message':
    case 'spend_money':
      risk = 'high';
      break;
    case 'delete_data':
    case 'change_credentials':
    case 'modify_approval_system':
    case 'disable_safety':
      risk = 'critical';
      break;
    default:
      // Unknown tool: fail closed — treat as high until registered.
      risk = 'high';
  }

  // Argument-based escalation.
  if (tool === 'run_shell') {
    const cmd = String(args.command ?? '');
    if (/\brm\s+-rf\b/.test(cmd) || /\bDROP\s+DATABASE\b/i.test(cmd) || />\s*\/dev\/sd/.test(cmd)) {
      risk = 'critical';
    }
  }
  if (tool === 'edit_file') {
    const path = String(args.path ?? '');
    if (path.includes('.env') || path.includes('credentials') || path.includes('.ssh/')) {
      risk = 'critical';
    }
  }
  if (tool === 'send_message') {
    const external = args.external === true;
    if (external) risk = higher(risk, 'high');
  }
  // Path traversal in any file tool escalates to critical (never execute).
  const pathArg = typeof args.path === 'string' ? args.path : '';
  if (pathArg.includes('..')) risk = 'critical';

  // LLM second opinion: higher risk wins.
  if (call.llmOpinion) risk = higher(risk, call.llmOpinion);
  return risk;
}

export function needsApproval(risk: RiskLevel): boolean {
  return risk !== 'low';
}

export interface Approval {
  id: string;
  toolCall: ToolCall;
  risk: RiskLevel;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decidedBy?: string;
}

export const APPROVAL_TTL_MS = 15 * 60 * 1000;

export function createApproval(id: string, call: ToolCall, now = Date.now()): Approval {
  return {
    id,
    toolCall: call,
    risk: classifyRisk(call),
    createdAt: now,
    expiresAt: now + APPROVAL_TTL_MS,
    status: 'pending',
  };
}

export function approve(a: Approval, by: string, now = Date.now()): Approval {
  if (a.status !== 'pending') throw new Error(`approval ${a.id} already ${a.status}`);
  if (now > a.expiresAt) return { ...a, status: 'expired' };
  return { ...a, status: 'approved', decidedBy: by };
}

export function reject(a: Approval, by: string): Approval {
  if (a.status !== 'pending') throw new Error(`approval ${a.id} already ${a.status}`);
  return { ...a, status: 'rejected', decidedBy: by };
}

export function isExpired(a: Approval, now = Date.now()): boolean {
  return a.status === 'pending' && now > a.expiresAt;
}

// ---------------------------------------------------------------------------
// Tests — the spec
// ---------------------------------------------------------------------------

describe('classifyRisk — rules layer', () => {
  it('classifies reads and searches as low', () => {
    for (const tool of ['read_file', 'list_files', 'web_search', 'summarise', 'list_tasks']) {
      expect(classifyRisk({ tool, args: {} })).toBe('low');
    }
  });

  it('classifies edits and drafts as medium', () => {
    expect(classifyRisk({ tool: 'edit_file', args: { path: 'src/a.ts' } })).toBe('medium');
    expect(classifyRisk({ tool: 'install_dependency', args: { name: 'lodash' } })).toBe('medium');
    expect(classifyRisk({ tool: 'send_draft_message', args: {} })).toBe('medium');
  });

  it('classifies merges, deploys, shell, and sends as high', () => {
    expect(classifyRisk({ tool: 'merge_worktree', args: {} })).toBe('high');
    expect(classifyRisk({ tool: 'deploy', args: {} })).toBe('high');
    expect(classifyRisk({ tool: 'run_shell', args: { command: 'npm test' } })).toBe('high');
    expect(classifyRisk({ tool: 'send_message', args: {} })).toBe('high');
    expect(classifyRisk({ tool: 'spend_money', args: { amount_usd: 1 } })).toBe('high');
  });

  it('classifies deletes, credential changes, and safety changes as critical', () => {
    expect(classifyRisk({ tool: 'delete_data', args: {} })).toBe('critical');
    expect(classifyRisk({ tool: 'change_credentials', args: {} })).toBe('critical');
    expect(classifyRisk({ tool: 'modify_approval_system', args: {} })).toBe('critical');
    expect(classifyRisk({ tool: 'disable_safety', args: {} })).toBe('critical');
  });

  it('fails closed on unknown tools', () => {
    expect(classifyRisk({ tool: 'do_anything', args: {} })).toBe('high');
  });

  it('escalates destructive shell commands to critical', () => {
    expect(classifyRisk({ tool: 'run_shell', args: { command: 'rm -rf /' } })).toBe('critical');
    expect(classifyRisk({ tool: 'run_shell', args: { command: 'DROP DATABASE prod' } })).toBe('critical');
  });

  it('escalates edits to secrets files to critical', () => {
    expect(classifyRisk({ tool: 'edit_file', args: { path: '.env' } })).toBe('critical');
    expect(classifyRisk({ tool: 'edit_file', args: { path: 'config/credentials.json' } })).toBe('critical');
    expect(classifyRisk({ tool: 'edit_file', args: { path: '~/.ssh/id_ed25519' } })).toBe('critical');
  });

  it('escalates path traversal to critical, even for read tools', () => {
    expect(classifyRisk({ tool: 'read_file', args: { path: '../../etc/passwd' } })).toBe('critical');
  });

  it('lets a higher LLM second opinion win, never a lower one', () => {
    expect(classifyRisk({ tool: 'read_file', args: {}, llmOpinion: 'high' })).toBe('high');
    expect(classifyRisk({ tool: 'delete_data', args: {}, llmOpinion: 'low' })).toBe('critical');
  });
});

describe('needsApproval', () => {
  it('only low-risk calls run without approval', () => {
    expect(needsApproval('low')).toBe(false);
    expect(needsApproval('medium')).toBe(true);
    expect(needsApproval('high')).toBe(true);
    expect(needsApproval('critical')).toBe(true);
  });
});

describe('Approval lifecycle', () => {
  const call: ToolCall = { tool: 'edit_file', args: { path: 'src/a.ts' } };

  it('creates a pending approval with a 15-minute expiry', () => {
    const now = Date.now();
    const a = createApproval('appr-1', call, now);
    expect(a.status).toBe('pending');
    expect(a.risk).toBe('medium');
    expect(a.expiresAt - a.createdAt).toBe(APPROVAL_TTL_MS);
  });

  it('approves a pending approval and records who decided', () => {
    const a = approve(createApproval('appr-1', call), 'owner-123');
    expect(a.status).toBe('approved');
    expect(a.decidedBy).toBe('owner-123');
  });

  it('rejects a pending approval', () => {
    const a = reject(createApproval('appr-1', call), 'owner-123');
    expect(a.status).toBe('rejected');
  });

  it('refuses to approve twice', () => {
    const a = approve(createApproval('appr-1', call), 'owner-123');
    expect(() => approve(a, 'owner-123')).toThrow();
  });

  it('expires instead of approving after the TTL', () => {
    const a = createApproval('appr-1', call, 1_000);
    const decided = approve(a, 'owner-123', 1_000 + APPROVAL_TTL_MS + 1);
    expect(decided.status).toBe('expired');
    expect(isExpired(createApproval('appr-1', call, 1_000), 1_000 + APPROVAL_TTL_MS + 1)).toBe(true);
  });

  it('is not expired before the TTL', () => {
    const a = createApproval('appr-1', call, 1_000);
    expect(isExpired(a, 1_000 + APPROVAL_TTL_MS - 1)).toBe(false);
  });
});
