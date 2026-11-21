import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../db/index.js';
import { AgentManager } from '../agents/agent-manager.js';
import { AGENT_PRESETS } from '../agents/presets.js';
import { TurnCoordinator } from '../orchestrator/turn-coordinator.js';
import { ApprovalGate } from '../safety/approval-gate.js';
import { SharedMemoryEngine } from '../memory/shared-memory.js';
import { CostTracker } from '../audit/cost-tracker.js';
import { CrashRecoveryManager } from '../tasks/crash-recovery.js';
import { TelegramBotEngine } from '../bot/telegram-bot.js';
import { runnerHub } from '../runner-hub/hub.js';
import { EmergencyKillSwitch } from '../safety/kill-switch.js';
import { UnifiedSearchEngine } from './search.js';
import { GitRollbackController } from '../git/git-rollback.js';
import { CronScheduler } from '../scheduler/cron-scheduler.js';
import { getMiniWebAppHtml } from './mini-web-html.js';
import { InterMinisterialDebateEngine } from '../cambodia/debate-engine.js';

export class HttpApiServer {
  private static webClients: Set<WebSocket> = new Set();

  public static setupWebSocket(wss: WebSocketServer): void {
    wss.on('connection', (ws: WebSocket) => {
      this.webClients.add(ws);
      console.log(`[Websocket] Mini Web client connected. Total clients: ${this.webClients.size}`);

      ws.on('close', () => {
        this.webClients.delete(ws);
      });

      // Send initial hello and historical debate messages so client immediately sees active discussions
      const debateHistory = db.getMessages('room-cabinet-council', 30);
      ws.send(JSON.stringify({
        type: 'INITIAL_MESSAGES',
        messages: debateHistory.length > 0 ? debateHistory : db.getMessages('room-main-squad', 20)
      }));
    });

    // Register TurnCoordinator real-time callbacks
    TurnCoordinator.registerCallbacks({
      onAgentStatus: (roomId, agentName, state) => {
        this.broadcast({ type: 'AGENT_STATUS', roomId, agentName, state });
      },
      onAgentQueueUpdate: (roomId, queueInfo) => {
        this.broadcast({ type: 'AGENT_QUEUE', roomId, queueInfo });
      },
      onNewMessage: (message) => {
        this.broadcast({ type: 'NEW_MESSAGE', message });
      },
      onApprovalRequired: (approval) => {
        this.broadcast({ type: 'APPROVAL_REQUIRED', approval });
        TelegramBotEngine.sendApprovalAlert(approval);
      },
      onTaskProgress: (taskId, currentStep, status) => {
        this.broadcast({ type: 'TASK_PROGRESS', taskId, currentStep, status });
      }
    });
  }

  public static broadcast(data: any): void {
    const payload = JSON.stringify(data);
    for (const client of this.webClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  public static async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-telegram-init-data');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    try {
      // Helper to read JSON body
      const readBody = async (): Promise<any> => {
        return new Promise((resolve, reject) => {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch (e) {
              reject(new Error('Invalid JSON'));
            }
          });
        });
      };

      // Helper for JSON responses
      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      };

      // --- Routes ---

      // 0. Serve Sovereign Mini Web App Dashboard
      if ((pathname === '/' || pathname === '/mini-app' || pathname === '/index.html') && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getMiniWebAppHtml());
        return;
      }

      // 0.5. Automated Inter-Ministerial Debate on Breaking Topics
      if (pathname === '/api/debate' && req.method === 'POST') {
        const body = await readBody();
        const result = await InterMinisterialDebateEngine.deliberateOnTopic({
          topic: body.topic || 'វិធានការសន្តិសុខ និងសេវាសាធារណៈជូនប្រជាពលរដ្ឋ',
          initiatedBy: body.initiatedBy || 'Web User'
        });
        return json(result);
      }

      // 1. System Status
      if (pathname === '/api/system/status' && req.method === 'GET') {
        const runners = db.getRunnerLeases();
        const agents = db.getAgents();
        const tasks = db.getTasks();
        const pendingApprovals = db.getApprovalRequests('pending');
        const user = db.getUsers()[0];

        return json({
          runnerStatus: runnerHub.isAnyRunnerConnected() || runners.some(r => r.status === 'online') ? 'Online' : 'Standby / Local',
          activeAgentsCount: agents.filter(a => a.status === 'active').length,
          totalAgentsCount: agents.length,
          pendingTasksCount: tasks.filter(t => t.status === 'running' || t.status === 'pending').length,
          pendingApprovalsCount: pendingApprovals.length,
          awayModeEnabled: user?.awayModeEnabled || false,
          uptimeSeconds: Math.floor(process.uptime()),
          runners
        });
      }

      // 2. Auth Verification (Telegram WebApp initData)
      if (pathname === '/api/auth/verify' && req.method === 'POST') {
        const body = await readBody();
        const result = TelegramBotEngine.validateTelegramInitData(body.initData);
        return json(result);
      }

      // 3. Presets
      if (pathname === '/api/presets' && req.method === 'GET') {
        return json(AGENT_PRESETS);
      }

      // 4. Agents CRUD
      if (pathname === '/api/agents' && req.method === 'GET') {
        return json(AgentManager.listAgents());
      }

      if (pathname === '/api/agents' && req.method === 'POST') {
        const body = await readBody();
        if (body.presetId) {
          const agent = AgentManager.createAgentFromPreset(body);
          this.broadcast({ type: 'AGENT_CREATED', agent });
          return json(agent, 201);
        }
        const agent = AgentManager.createAgent(body);
        this.broadcast({ type: 'AGENT_CREATED', agent });
        return json(agent, 201);
      }

      const agentIdMatch = pathname.match(/^\/api\/agents\/([^/]+)$/);
      if (agentIdMatch) {
        const id = agentIdMatch[1];
        if (req.method === 'PUT') {
          const body = await readBody();
          const updated = AgentManager.updateAgent(id, body);
          this.broadcast({ type: 'AGENT_UPDATED', agent: updated });
          return json(updated);
        }
        if (req.method === 'DELETE') {
          const success = AgentManager.deleteAgent(id);
          this.broadcast({ type: 'AGENT_DELETED', id });
          return json({ success });
        }
      }

      const pauseMatch = pathname.match(/^\/api\/agents\/([^/]+)\/pause$/);
      if (pauseMatch && req.method === 'POST') {
        const updated = AgentManager.togglePauseAgent(pauseMatch[1]);
        this.broadcast({ type: 'AGENT_UPDATED', agent: updated });
        return json(updated);
      }

      const cloneMatch = pathname.match(/^\/api\/agents\/([^/]+)\/clone$/);
      if (cloneMatch && req.method === 'POST') {
        const cloned = AgentManager.cloneAgent(cloneMatch[1]);
        this.broadcast({ type: 'AGENT_CREATED', agent: cloned });
        return json(cloned, 201);
      }

      // 5. Rooms & Messages
      if (pathname === '/api/rooms' && req.method === 'GET') {
        return json(db.getRooms());
      }

      if (pathname === '/api/rooms' && req.method === 'POST') {
        const body = await readBody();
        const room = db.createRoom(body);
        return json(room, 201);
      }

      const roomMessagesMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/messages$/);
      if (roomMessagesMatch) {
        const roomId = roomMessagesMatch[1];
        if (req.method === 'GET') {
          return json(db.getMessages(roomId));
        }
        if (req.method === 'POST') {
          const body = await readBody();
          const msg = await TurnCoordinator.handleMessage({
            roomId,
            senderType: 'human',
            senderId: body.senderId || 'user-web',
            senderName: body.senderName || 'Human Engineer',
            content: body.content
          });
          return json(msg, 201);
        }
      }

      // 6. Tasks
      if (pathname === '/api/tasks' && req.method === 'GET') {
        return json(db.getTasks());
      }

      const taskRetryMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/retry$/);
      if (taskRetryMatch && req.method === 'POST') {
        const success = CrashRecoveryManager.retryTask(taskRetryMatch[1]);
        return json({ success });
      }

      // 7. Approvals
      if (pathname === '/api/approvals' && req.method === 'GET') {
        const status = url.searchParams.get('status') || undefined;
        return json(db.getApprovalRequests(status));
      }

      const approveMatch = pathname.match(/^\/api\/approvals\/([^/]+)\/approve$/);
      if (approveMatch && req.method === 'POST') {
        const updated = ApprovalGate.approve(approveMatch[1], 'Human Engineer (Web)');
        this.broadcast({ type: 'APPROVAL_UPDATED', approval: updated });
        return json(updated);
      }

      const rejectMatch = pathname.match(/^\/api\/approvals\/([^/]+)\/reject$/);
      if (rejectMatch && req.method === 'POST') {
        const body = await readBody();
        const updated = ApprovalGate.reject(rejectMatch[1], 'Human Engineer (Web)', body.reason);
        this.broadcast({ type: 'APPROVAL_UPDATED', approval: updated });
        return json(updated);
      }

      // 8. Worktrees
      if (pathname === '/api/worktrees' && req.method === 'GET') {
        return json(db.getWorktrees());
      }

      // 9. Shared Memory
      if (pathname === '/api/memory' && req.method === 'GET') {
        return json(db.getMemories());
      }

      if (pathname === '/api/memory' && req.method === 'POST') {
        const body = await readBody();
        const mem = db.addMemory({
          userId: body.userId || 'user-owner',
          projectId: body.projectId,
          scope: body.scope || 'GLOBAL',
          ruleText: body.ruleText,
          category: body.category || 'general',
          confidence: body.confidence || 0.95,
          isVerified: true
        });
        return json(mem, 201);
      }

      const memoryIdMatch = pathname.match(/^\/api\/memory\/([^/]+)$/);
      if (memoryIdMatch) {
        const id = memoryIdMatch[1];
        if (req.method === 'PUT') {
          const body = await readBody();
          const updated = db.updateMemory(id, body);
          return json(updated);
        }
        if (req.method === 'DELETE') {
          const success = db.deleteMemory(id);
          return json({ success });
        }
      }

      // 10. Audit Logs
      if (pathname === '/api/audit' && req.method === 'GET') {
        return json(db.getAuditLogs());
      }

      // 11. Cost Tracker
      if (pathname === '/api/costs' && req.method === 'GET') {
        return json(CostTracker.getMetrics());
      }

      // 12. Away Mode Toggle
      if (pathname === '/api/away-mode' && req.method === 'GET') {
        const user = db.getUsers()[0];
        return json({
          awayModeEnabled: user?.awayModeEnabled || false,
          awaySince: user?.awaySince
        });
      }

      if (pathname === '/api/away-mode/toggle' && req.method === 'POST') {
        const user = db.getUsers()[0];
        if (user) {
          const newState = !user.awayModeEnabled;
          db.upsertUser({
            ...user,
            awayModeEnabled: newState,
            awaySince: newState ? new Date().toISOString() : undefined
          });
          this.broadcast({ type: 'AWAY_MODE_CHANGED', enabled: newState });
          return json({ awayModeEnabled: newState });
        }
        return json({ awayModeEnabled: false });
      }

      // 13. Emergency Kill Switch ("STOP ALL")
      if (pathname === '/api/system/kill-switch' && req.method === 'GET') {
        return json(EmergencyKillSwitch.getStatus());
      }

      if (pathname === '/api/system/kill-switch' && req.method === 'POST') {
        const body = await readBody();
        const res = EmergencyKillSwitch.trigger(body.reason, body.triggeredBy || 'Super Admin (Web)');
        this.broadcast({ type: 'KILL_SWITCH_TRIGGERED', status: EmergencyKillSwitch.getStatus() });
        return json(res);
      }

      if (pathname === '/api/system/kill-switch/resume' && req.method === 'POST') {
        const body = await readBody();
        const success = EmergencyKillSwitch.disengage(body.resumedBy || 'Super Admin (Web)');
        this.broadcast({ type: 'KILL_SWITCH_DISENGAGED' });
        return json({ success });
      }

      // 14. Unified Search
      if (pathname === '/api/search' && req.method === 'GET') {
        const query = url.searchParams.get('q') || '';
        return json(UnifiedSearchEngine.search(query));
      }

      // 15. Message Feedback (👍/👎)
      const feedbackMatch = pathname.match(/^\/api\/messages\/([^/]+)\/feedback$/);
      if (feedbackMatch && req.method === 'POST') {
        const messageId = feedbackMatch[1];
        const body = await readBody();
        db.addAuditLog('MESSAGE_FEEDBACK', { messageId, rating: body.rating, comment: body.comment });
        return json({ success: true, messageId, rating: body.rating });
      }

      // 16. Multimodal Image / File Upload
      if (pathname === '/api/upload' && req.method === 'POST') {
        const body = await readBody();
        const uploadedFile = {
          fileId: `file-${Date.now()}`,
          fileName: body.fileName || 'upload.jpg',
          mimeType: body.mimeType || 'image/jpeg',
          base64Data: body.base64Data || '',
          uploadedAt: new Date().toISOString()
        };
        db.addAuditLog('FILE_UPLOADED', { fileId: uploadedFile.fileId, fileName: uploadedFile.fileName });
        return json(uploadedFile, 201);
      }

      // 17. Git Rollback / Undo
      if (pathname === '/api/rollback' && req.method === 'GET') {
        return json(GitRollbackController.listSnapshots());
      }

      const rollbackExecMatch = pathname.match(/^\/api\/rollback\/([^/]+)$/);
      if (rollbackExecMatch && req.method === 'POST') {
        const res = await GitRollbackController.executeRollback(rollbackExecMatch[1]);
        this.broadcast({ type: 'ROLLBACK_EXECUTED', result: res });
        return json(res);
      }

      // 18. Cron Scheduled Tasks
      if (pathname === '/api/schedule' && req.method === 'GET') {
        return json(CronScheduler.listJobs());
      }

      if (pathname === '/api/schedule' && req.method === 'POST') {
        const body = await readBody();
        const job = CronScheduler.addJob(body);
        return json(job, 201);
      }

      const scheduleToggleMatch = pathname.match(/^\/api\/schedule\/([^/]+)\/toggle$/);
      if (scheduleToggleMatch && req.method === 'POST') {
        const job = CronScheduler.toggleJob(scheduleToggleMatch[1]);
        return json(job);
      }

      const scheduleDeleteMatch = pathname.match(/^\/api\/schedule\/([^/]+)$/);
      if (scheduleDeleteMatch && req.method === 'DELETE') {
        const success = CronScheduler.deleteJob(scheduleDeleteMatch[1]);
        return json({ success });
      }

      // 404 Fallback
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Route ${req.method} ${pathname} not found` }));
    } catch (err: any) {
      console.error('[HttpApi] Server error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  }
}
