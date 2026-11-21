import { db } from '../db/index.js';
import type { Agent, Room, Message, ApprovalRequest } from '../db/schema.js';
import { config } from '../config/index.js';
import { LLMGateway, type LLMRequestMessage } from '../llm/gateway.js';
import { SharedMemoryEngine } from '../memory/shared-memory.js';
import { DAGPlanner } from './dag-planner.js';
import { ApprovalGate } from '../safety/approval-gate.js';
import { KhmerLanguageAuditor } from '../cambodia/khmer-auditor.js';
import { khmerLegalEngine } from '../cambodia/legal-engine.js';

export interface TurnEventCallbacks {
  onAgentStatus?: (roomId: string, agentName: string, state: 'typing' | 'running_tests' | 'reviewing_code' | 'idle') => void;
  onAgentQueueUpdate?: (roomId: string, queueInfo: { currentSpeaker?: string; waiting: string[] }) => void;
  onNewMessage?: (message: Message) => void;
  onApprovalRequired?: (approval: ApprovalRequest) => void;
  onTaskProgress?: (taskId: string, currentStep: number, status: string) => void;
}

export class TurnCoordinator {
  private static activeLocks: Set<string> = new Set();
  private static callbacks: TurnEventCallbacks = {};

  public static registerCallbacks(cbs: TurnEventCallbacks): void {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  /**
   * Handle incoming message from human or bot command.
   */
  public static async handleMessage(params: {
    roomId: string;
    senderType: 'human' | 'system';
    senderId: string;
    senderName: string;
    content: string;
  }): Promise<Message> {
    const room = db.getRoomById(params.roomId);
    if (!room) throw new Error(`Room ${params.roomId} not found`);

    // 1. Save user message to database
    const userMessage = db.addMessage({
      roomId: params.roomId,
      senderType: params.senderType,
      senderId: params.senderId,
      senderName: params.senderName,
      content: params.content
    });

    if (this.callbacks.onNewMessage) {
      this.callbacks.onNewMessage(userMessage);
    }

    // 2. Check if user is teaching/correcting habits (Shared Memory extraction)
    if (params.senderType === 'human') {
      const correction = SharedMemoryEngine.detectCorrection(params.content, room.projectId);
      if (correction) {
        const { memory, conflictWith } = SharedMemoryEngine.saveLearnedRule({
          userId: params.senderId,
          projectId: room.projectId,
          ruleText: correction.ruleText,
          scope: correction.scope,
          category: correction.category,
          sourceMessageId: userMessage.id
        });

        // Add system confirmation message in chat
        const sysMsg = db.addMessage({
          roomId: params.roomId,
          senderType: 'system',
          senderId: 'system',
          senderName: 'Shared Memory Engine',
          content: `🧠 **ចងចាំទម្លាប់ថ្មីបានជោគជ័យ (${memory.scope})**: "${memory.ruleText}"${conflictWith ? `\n*(ចំណាំ: រកឃើញច្បាប់ចាស់ដែលស្រដៀងគ្នា: "${conflictWith.ruleText}")*` : ''}`
        });
        if (this.callbacks.onNewMessage) this.callbacks.onNewMessage(sysMsg);
      }
    }

    // 3. Trigger sequential agent turn loop
    this.triggerTurnLoop(params.roomId, params.content).catch(err => {
      console.error('Error during agent turn loop:', err);
    });

    return userMessage;
  }

  /**
   * Sequential Turn-Taking Loop with room locking and anti-collision engine.
   */
  private static async triggerTurnLoop(roomId: string, triggerPrompt: string): Promise<void> {
    if (this.activeLocks.has(roomId)) {
      console.log(`Room ${roomId} is already processing turns. Queued.`);
      return;
    }

    this.activeLocks.add(roomId);
    db.updateRoom(roomId, { isLocked: true });

    try {
      const room = db.getRoomById(roomId);
      if (!room) return;

      const project = db.getProjectById(room.projectId);
      const projectAgents = db.getAgents(room.projectId).filter(a => a.status === 'active');

      // Check for @mention
      const mentionedAgent = projectAgents.find(a => triggerPrompt.toLowerCase().includes(`@${a.name.toLowerCase().split(' ')[0]}`));

      let turnSequence: Agent[] = [];

      if (mentionedAgent) {
        // Direct mention: that agent speaks first, then lead reviews
        const lead = db.getLeadAgent(room.projectId) || projectAgents[0];
        turnSequence = [mentionedAgent];
        if (lead && lead.id !== mentionedAgent.id) turnSequence.push(lead);
      } else {
        // Standard Lead-driven pipeline: Lead -> Dev -> QA -> Reviewer
        const lead = db.getLeadAgent(room.projectId) || projectAgents.find(a => a.role === 'lead');
        const dev = projectAgents.find(a => a.role === 'developer');
        const qa = projectAgents.find(a => a.role === 'qa');
        const reviewer = projectAgents.find(a => a.role === 'reviewer');

        if (lead) turnSequence.push(lead);
        if (dev) turnSequence.push(dev);
        if (qa) turnSequence.push(qa);
        if (reviewer) turnSequence.push(reviewer);
      }

      if (turnSequence.length === 0) {
        turnSequence = projectAgents.slice(0, 3);
      }

      // Initialize Task DAG
      const leadAgent = turnSequence[0];
      const task = DAGPlanner.createDefaultTaskDAG({
        projectId: room.projectId,
        roomId: room.id,
        leadAgentId: leadAgent.id,
        userRequest: triggerPrompt
      });

      let turnsExecuted = 0;
      let lastAgentOutput = '';

      for (let i = 0; i < turnSequence.length; i++) {
        const agent = turnSequence[i];
        turnsExecuted++;

        if (turnsExecuted > config.maxTurnsPerTrigger) {
          console.log(`Max turns limit (${config.maxTurnsPerTrigger}) reached for room ${roomId}. Halting loop.`);
          break;
        }

        // Update waiting queue for UI
        const waitingNames = turnSequence.slice(i + 1).map(a => `${a.name} (${a.role.toUpperCase()})`);
        db.updateRoom(roomId, {
          currentSpeakerId: agent.id,
          activeTurnQueue: turnSequence.slice(i + 1).map(a => a.id)
        });

        if (this.callbacks.onAgentQueueUpdate) {
          this.callbacks.onAgentQueueUpdate(roomId, {
            currentSpeaker: `${agent.name} (${agent.role})`,
            waiting: waitingNames
          });
        }

        // Broadcast typing/working state
        const workingState = agent.role === 'qa' ? 'running_tests' : agent.role === 'reviewer' ? 'reviewing_code' : 'typing';
        if (this.callbacks.onAgentStatus) {
          this.callbacks.onAgentStatus(roomId, agent.name, workingState);
        }

        // Simulate or execute brief processing delay for realistic UX
        await new Promise(r => setTimeout(r, 1200));

        // Build Agent Prompt Context
        const memoryInjection = SharedMemoryEngine.getPromptInjectionBlock(room.projectId, triggerPrompt);
        const chatHistory = db.getMessages(roomId, 6).map(m => `${m.senderName}: ${m.content}`).join('\n\n');

        // Retrieve Relevant Cambodian Laws & Constitutional Principles
        const relevantLaws = khmerLegalEngine.searchRelevantLaws(triggerPrompt, 2);
        const legalContext = relevantLaws.length > 0
          ? `\n[RELEVANT CAMBODIAN LAWS & GOVERNANCE PRINCIPLES]\n${khmerLegalEngine.formatLegalCitations(relevantLaws)}\n`
          : '';

        const systemMessage = `
${agent.systemPrompt}

${memoryInjection}
${legalContext}
[PROJECT CONTEXT]
Project Name: ${project?.name || 'ANGKOR Core'}
Local Repo Path: ${project?.localRepoPath || 'workspace/'}
Current Task: ${task.title}
Role Responsibility: You are acting as ${agent.name} (${agent.role}). Coordinate smoothly with other agents.
Strict Directives:
1. Uphold national social development, social justice, and the rule of law.
2. Zero tolerance for corruption and zero tolerance for nepotism/cronyism.
3. Adhere strictly to the Cambodian Constitution (Article 51 Multiparty Democracy) and all national laws.

[CURRENT CHAT HISTORY]
${chatHistory}
`.trim();

        const messages: LLMRequestMessage[] = [
          { role: 'system', content: systemMessage },
          {
            role: 'user',
            content: i === 0
              ? triggerPrompt
              : `Previous agent output:\n${lastAgentOutput}\n\nPlease proceed with your role-specific actions.`
          }
        ];

        // Call LLM Gateway
        const llmRes = await LLMGateway.generateResponse({
          messages,
          preferredModel: agent.model
        });

        // Audit & Purify Khmer Text with Chuon Nath Orthography & Diplomatic Standards
        const { cleanText } = KhmerLanguageAuditor.auditAndPurify(llmRes.content);
        lastAgentOutput = cleanText;

        // Check if agent proposes a risky action (Push or Merge)
        let approvalReq: ApprovalRequest | undefined;
        if (agent.role === 'reviewer' || lastAgentOutput.includes('Risky Action') || lastAgentOutput.includes('Approval')) {
          approvalReq = ApprovalGate.createRequest({
            roomId: room.id,
            agentId: agent.id,
            taskId: task.id,
            actionType: 'merge_main',
            summary: `Merge verified branch 'agent/dev/task-optimization' into main branch for project '${project?.name}'.`,
            diffPayload: `diff --git a/src/service.ts b/src/service.ts\n--- a/src/service.ts\n+++ b/src/service.ts\n@@ -10,4 +10,12 @@\n+ // Optimized query cache with Redis\n+ export const getCachedItems = async () => {...};\n`,
            targetRepo: project?.name || 'my-shop',
            branchName: 'agent/dev/task-optimization',
            targetCommitSha: 'a1b2c3d4e5f6',
            expiresInMinutes: 180
          });

          if (this.callbacks.onApprovalRequired) {
            this.callbacks.onApprovalRequired(approvalReq);
          }
        }

        // Save Agent Response Message
        const agentMsg = db.addMessage({
          roomId: room.id,
          senderType: 'agent',
          senderId: agent.id,
          senderName: agent.name,
          content: cleanText,
          metadata: {
            approvalId: approvalReq?.id,
            reasoningBrief: `Tokens: ${llmRes.tokensUsed.totalTokens} | Model: ${llmRes.model} | Latency: ${llmRes.durationMs}ms`,
            diffSnippet: approvalReq?.diffPayload
          }
        });

        if (this.callbacks.onNewMessage) {
          this.callbacks.onNewMessage(agentMsg);
        }

        // Update Task Checkpoint & DAG node
        if (task.dag[i]) {
          task.dag[i].status = 'completed';
          task.dag[i].output = llmRes.content.substring(0, 200);
          task.currentStep = i + 1;
          db.updateTask(task.id, { dag: task.dag, currentStep: task.currentStep });
          db.addCheckpoint(task.id, i + 1, { lastSpeaker: agent.name, tokens: llmRes.tokensUsed });
          if (this.callbacks.onTaskProgress) {
            this.callbacks.onTaskProgress(task.id, i + 1, 'in_progress');
          }
        }

        // If approval is required, pause execution loop until human approves!
        if (approvalReq) {
          db.updateTask(task.id, { status: 'waiting_approval' });
          console.log(`Task ${task.id} paused waiting for human approval.`);
          break;
        }

        // Circuit breaker: If QA failed, break or route back
        if (agent.role === 'qa' && lastAgentOutput.includes('QA FAIL')) {
          console.log('QA suite failed. Halting forward propagation to reviewer.');
          break;
        }
      }

      // Mark task complete if not paused for approval
      const finalTask = db.getTaskById(task.id);
      if (finalTask && finalTask.status !== 'waiting_approval') {
        db.updateTask(task.id, { status: 'completed' });
        if (this.callbacks.onTaskProgress) {
          this.callbacks.onTaskProgress(task.id, finalTask.dag.length, 'completed');
        }
      }

    } finally {
      this.activeLocks.delete(roomId);
      db.updateRoom(roomId, { isLocked: false, currentSpeakerId: undefined, activeTurnQueue: [] });

      if (this.callbacks.onAgentStatus) {
        this.callbacks.onAgentStatus(roomId, '', 'idle');
      }
      if (this.callbacks.onAgentQueueUpdate) {
        this.callbacks.onAgentQueueUpdate(roomId, { currentSpeaker: undefined, waiting: [] });
      }
    }
  }
}
