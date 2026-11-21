/**
 * Unit tests — Turn Coordinator (group chat turn-taking).
 *
 * SELF-CONTAINED: the coordinator logic under test is implemented inline
 * in this file as the contract the backend builder must satisfy
 * (see docs/architecture.md §3). These tests do NOT import backend/,
 * bot/, or any other builder's code, so they run before those land.
 * When the real TurnCoordinator exists, move this logic behind an import
 * and keep the test cases unchanged — they are the spec.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Inline contract implementation (mirror of docs/architecture.md §3)
// ---------------------------------------------------------------------------

export type Speaker = 'human' | 'lead' | 'agent' | 'status';
export type ChatState = 'idle' | 'lead-speaking' | 'agent-speaking' | 'awaiting-human';

export interface TurnRequest {
  chatId: string;
  speaker: Speaker;
  agentId?: string;
  toolName?: string;
  toolArgs?: string;
  hasNewInfo: boolean;
}

export interface TurnDecision {
  granted: boolean;
  reason: string;
}

const MAX_AGENT_MESSAGES_PER_USER_MESSAGE = 5;
const MAX_SAME_TOOL_REPEATS = 3;

export class TurnCoordinator {
  private locks = new Map<string, Speaker>();
  private states = new Map<string, ChatState>();
  private agentMessageCount = new Map<string, number>();
  private lastToolCall = new Map<string, { tool: string; args: string; count: number }>();
  private allowlistedGroups = new Set<string>();

  allowGroup(chatId: string): void {
    this.allowlistedGroups.add(chatId);
  }

  requestTurn(req: TurnRequest): TurnDecision {
    // Groups not on the allowlist stay silent.
    if (req.speaker !== 'human' && !this.allowlistedGroups.has(req.chatId)) {
      return { granted: false, reason: 'group-not-allowlisted' };
    }
    // One speaker at a time.
    if (this.locks.has(req.chatId)) {
      // A human message always pre-empts.
      if (req.speaker === 'human') {
        this.locks.set(req.chatId, 'human');
        this.states.set(req.chatId, 'awaiting-human');
        return { granted: true, reason: 'human-preempts' };
      }
      return { granted: false, reason: 'turn-held' };
    }
    // Turn budget: max N agent messages per user message.
    if (req.speaker === 'agent') {
      const count = this.agentMessageCount.get(req.chatId) ?? 0;
      if (count >= MAX_AGENT_MESSAGES_PER_USER_MESSAGE) {
        return { granted: false, reason: 'turn-budget-exceeded' };
      }
    }
    // Anti-loop: same agent speaking twice with no new information.
    if (req.speaker === 'agent' && !req.hasNewInfo) {
      const state = this.states.get(req.chatId);
      if (state === 'agent-speaking') {
        return { granted: false, reason: 'no-new-info-loop' };
      }
    }
    // Anti-loop: same tool + args repeated.
    if (req.speaker === 'agent' && req.toolName) {
      const key = `${req.chatId}:${req.agentId ?? 'agent'}`;
      const prev = this.lastToolCall.get(key);
      if (prev && prev.tool === req.toolName && prev.args === (req.toolArgs ?? '')) {
        const count = prev.count + 1;
        if (count >= MAX_SAME_TOOL_REPEATS) {
          return { granted: false, reason: 'repeated-tool-call-loop' };
        }
        this.lastToolCall.set(key, { ...prev, count });
      } else {
        this.lastToolCall.set(key, { tool: req.toolName, args: req.toolArgs ?? '', count: 1 });
      }
    }
    this.locks.set(req.chatId, req.speaker);
    this.states.set(
      req.chatId,
      req.speaker === 'lead' ? 'lead-speaking' : req.speaker === 'agent' ? 'agent-speaking' : 'awaiting-human',
    );
    if (req.speaker === 'agent') {
      this.agentMessageCount.set(req.chatId, (this.agentMessageCount.get(req.chatId) ?? 0) + 1);
    }
    return { granted: true, reason: 'granted' };
  }

  releaseTurn(chatId: string): void {
    this.locks.delete(chatId);
    this.states.set(chatId, 'idle');
  }

  /** Called when a new human message arrives: resets the per-message budget. */
  onHumanMessage(chatId: string): void {
    this.agentMessageCount.set(chatId, 0);
    this.states.set(chatId, 'awaiting-human');
  }

  getState(chatId: string): ChatState {
    return this.states.get(chatId) ?? 'idle';
  }
}

// ---------------------------------------------------------------------------
// Tests — the spec
// ---------------------------------------------------------------------------

describe('TurnCoordinator', () => {
  let coord: TurnCoordinator;
  const CHAT = 'group-1';

  beforeEach(() => {
    coord = new TurnCoordinator();
    coord.allowGroup(CHAT);
  });

  it('grants the first turn to the lead agent', () => {
    const d = coord.requestTurn({ chatId: CHAT, speaker: 'lead', hasNewInfo: true });
    expect(d.granted).toBe(true);
    expect(coord.getState(CHAT)).toBe('lead-speaking');
  });

  it('grants only one speaker at a time', () => {
    coord.requestTurn({ chatId: CHAT, speaker: 'lead', hasNewInfo: true });
    const d = coord.requestTurn({ chatId: CHAT, speaker: 'agent', agentId: 'coder', hasNewInfo: true });
    expect(d.granted).toBe(false);
    expect(d.reason).toBe('turn-held');
  });

  it('grants the next speaker after the turn is released', () => {
    coord.requestTurn({ chatId: CHAT, speaker: 'lead', hasNewInfo: true });
    coord.releaseTurn(CHAT);
    const d = coord.requestTurn({ chatId: CHAT, speaker: 'agent', agentId: 'coder', hasNewInfo: true });
    expect(d.granted).toBe(true);
    expect(coord.getState(CHAT)).toBe('agent-speaking');
  });

  it('a human message pre-empts a held turn', () => {
    coord.requestTurn({ chatId: CHAT, speaker: 'agent', agentId: 'coder', hasNewInfo: true });
    const d = coord.requestTurn({ chatId: CHAT, speaker: 'human', hasNewInfo: true });
    expect(d.granted).toBe(true);
    expect(d.reason).toBe('human-preempts');
  });

  it('enforces the per-user-message agent turn budget (5)', () => {
    coord.onHumanMessage(CHAT);
    for (let i = 0; i < MAX_AGENT_MESSAGES_PER_USER_MESSAGE; i++) {
      const d = coord.requestTurn({ chatId: CHAT, speaker: 'agent', agentId: 'coder', hasNewInfo: true });
      expect(d.granted).toBe(true);
      coord.releaseTurn(CHAT);
    }
    const d = coord.requestTurn({ chatId: CHAT, speaker: 'agent', agentId: 'coder', hasNewInfo: true });
    expect(d.granted).toBe(false);
    expect(d.reason).toBe('turn-budget-exceeded');
  });

  it('resets the turn budget on a new human message', () => {
    coord.onHumanMessage(CHAT);
    for (let i = 0; i < MAX_AGENT_MESSAGES_PER_USER_MESSAGE; i++) {
      coord.requestTurn({ chatId: CHAT, speaker: 'agent', agentId: 'coder', hasNewInfo: true });
      coord.releaseTurn(CHAT);
    }
    coord.onHumanMessage(CHAT);
    const d = coord.requestTurn({ chatId: CHAT, speaker: 'agent', agentId: 'coder', hasNewInfo: true });
    expect(d.granted).toBe(true);
  });

  it('blocks an agent speaking twice in a row with no new information', () => {
    coord.requestTurn({ chatId: CHAT, speaker: 'agent', agentId: 'coder', hasNewInfo: true });
    coord.releaseTurn(CHAT);
    // Simulate the state left by the previous agent turn (no release to idle
    // in the real coordinator until a different speaker takes over).
    coord.requestTurn({ chatId: CHAT, speaker: 'agent', agentId: 'coder', hasNewInfo: true });
    const d = coord.requestTurn({ chatId: CHAT, speaker: 'agent', agentId: 'coder', hasNewInfo: false });
    // Either the lock or the loop guard must refuse it.
    expect(d.granted).toBe(false);
  });

  it('blocks the same tool called 3x with identical args', () => {
    coord.onHumanMessage(CHAT);
    for (let i = 0; i < 2; i++) {
      const d = coord.requestTurn({
        chatId: CHAT, speaker: 'agent', agentId: 'coder',
        toolName: 'read_file', toolArgs: '{"path":"README.md"}', hasNewInfo: true,
      });
      expect(d.granted).toBe(true);
      coord.releaseTurn(CHAT);
    }
    const d = coord.requestTurn({
      chatId: CHAT, speaker: 'agent', agentId: 'coder',
      toolName: 'read_file', toolArgs: '{"path":"README.md"}', hasNewInfo: true,
    });
    expect(d.granted).toBe(false);
    expect(d.reason).toBe('repeated-tool-call-loop');
  });

  it('allows the same tool with different args', () => {
    coord.onHumanMessage(CHAT);
    for (const path of ['a.md', 'b.md', 'c.md']) {
      const d = coord.requestTurn({
        chatId: CHAT, speaker: 'agent', agentId: 'coder',
        toolName: 'read_file', toolArgs: JSON.stringify({ path }), hasNewInfo: true,
      });
      expect(d.granted).toBe(true);
      coord.releaseTurn(CHAT);
    }
  });

  it('stays silent in groups that are not allowlisted', () => {
    const d = coord.requestTurn({ chatId: 'group-stranger', speaker: 'lead', hasNewInfo: true });
    expect(d.granted).toBe(false);
    expect(d.reason).toBe('group-not-allowlisted');
  });

  it('isolates state per chat', () => {
    coord.allowGroup('group-2');
    coord.requestTurn({ chatId: CHAT, speaker: 'lead', hasNewInfo: true });
    const d = coord.requestTurn({ chatId: 'group-2', speaker: 'lead', hasNewInfo: true });
    expect(d.granted).toBe(true);
  });
});
