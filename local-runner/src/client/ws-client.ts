import WebSocket from 'ws';
import os from 'os';
import { runnerConfig } from '../config/index.js';
import { WorktreeManager } from '../worktree/worktree-manager.js';
import { SandboxedExecutor } from '../sandbox/sandbox.js';
import { GitController } from '../git-ops/git-controller.js';

export class RunnerWsClient {
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;

  public start(): void {
    this.connect();
  }

  private connect(): void {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const url = `${runnerConfig.backendWsUrl}?token=${encodeURIComponent(runnerConfig.runnerToken)}&runnerId=${encodeURIComponent(runnerConfig.runnerId)}`;
    console.log(`[RunnerClient] Connecting to ANGKOR EYES Backend: ${runnerConfig.backendWsUrl}...`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.isConnecting = false;
      console.log(`[RunnerClient] Connected successfully as Runner ID: ${runnerConfig.runnerId}`);
      this.startHeartbeat();
    });

    this.ws.on('message', async (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'RPC_REQUEST') {
          await this.handleRpcRequest(msg);
        }
      } catch (err) {
        console.error('[RunnerClient] Failed to process message:', err);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.isConnecting = false;
      this.stopHeartbeat();
      console.warn(`[RunnerClient] Disconnected (${code}: ${reason}). Reconnecting in 5s...`);
      setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error('[RunnerClient] WebSocket connection error:', err.message);
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const freeMemMB = Math.round(os.freemem() / 1024 / 1024);
        const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);

        this.ws.send(JSON.stringify({
          type: 'HEARTBEAT',
          runnerId: runnerConfig.runnerId,
          payload: {
            platform: os.platform(),
            cpuUsage: Math.round(os.loadavg()[0] * 10) / 10,
            ramUsageMB: totalMemMB - freeMemMB,
            gitVersion: 'git-2.53'
          }
        }));
      }
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async handleRpcRequest(msg: { requestId: string; action: string; payload: any }): Promise<void> {
    const { requestId, action, payload } = msg;
    let result: any;

    try {
      switch (action) {
        case 'CREATE_WORKTREE':
          result = await WorktreeManager.createWorktree(payload);
          break;
        case 'EXEC_TOOL':
          result = await SandboxedExecutor.executeCommand(payload);
          break;
        case 'GET_DIFF':
          result = await WorktreeManager.getDiff(payload.worktreePath);
          break;
        case 'PUSH_BRANCH':
          result = await GitController.pushBranch(payload.worktreePath, payload.branchName);
          break;
        case 'REMOVE_WORKTREE':
          result = await WorktreeManager.removeWorktree(payload.worktreePath);
          break;
        default:
          result = { error: `Unsupported action: ${action}` };
      }
    } catch (err: any) {
      result = { error: err.message };
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'RPC_RESPONSE',
        runnerId: runnerConfig.runnerId,
        requestId,
        payload: result
      }));
    }
  }
}
