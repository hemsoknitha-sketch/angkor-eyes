export interface SystemStatus {
  runnerStatus: string;
  activeAgentsCount: number;
  totalAgentsCount: number;
  pendingTasksCount: number;
  pendingApprovalsCount: number;
  awayModeEnabled: boolean;
  uptimeSeconds: number;
  runners: any[];
}

export interface Agent {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  isLead: boolean;
  status: 'active' | 'paused';
  capabilities: Record<string, boolean>;
  command?: string;
  category?: string;
  officialWebsite?: string;
  officialFacebook?: string;
  isSupremeAdmin?: boolean;
  avatarColor?: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderType: 'human' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  content: string;
  metadata?: {
    approvalId?: string;
    reasoningBrief?: string;
    diffSnippet?: string;
    filesChanged?: any[];
  };
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  roomId: string;
  agentId: string;
  taskId?: string;
  actionType: string;
  summary: string;
  diffPayload?: string;
  actionHash: string;
  targetRepo: string;
  branchName: string;
  targetCommitSha: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface SharedMemory {
  id: string;
  userId: string;
  projectId?: string;
  scope: 'GLOBAL' | 'PROJECT';
  ruleText: string;
  category: string;
  confidence: number;
  version: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  roomId: string;
  leadAgentId: string;
  title: string;
  description: string;
  status: string;
  dag: Array<{
    id: string;
    agentRole: string;
    title: string;
    description: string;
    status: string;
    output?: string;
  }>;
  currentStep: number;
  createdAt: string;
}

class ApiService {
  private ws: WebSocket | null = null;
  private wsListeners: Set<(event: any) => void> = new Set();

  public getTelegramWebApp(): any {
    return (window as any).Telegram?.WebApp;
  }

  public initTelegram(): void {
    const tg = this.getTelegramWebApp();
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }

  public async fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.getTelegramWebApp()?.initData ? { 'x-telegram-init-data': this.getTelegramWebApp().initData } : {}),
        ...(options?.headers || {})
      }
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // System
  public getStatus(): Promise<SystemStatus> {
    return this.fetchJson<SystemStatus>('/api/system/status');
  }

  // Agents
  public getAgents(): Promise<Agent[]> {
    return this.fetchJson<Agent[]>('/api/agents');
  }

  public getPresets(): Promise<any[]> {
    return this.fetchJson<any[]>('/api/presets');
  }

  public createAgent(payload: any): Promise<Agent> {
    return this.fetchJson<Agent>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public updateAgent(id: string, updates: any): Promise<Agent> {
    return this.fetchJson<Agent>(`/api/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  public togglePauseAgent(id: string): Promise<Agent> {
    return this.fetchJson<Agent>(`/api/agents/${id}/pause`, { method: 'POST' });
  }

  public cloneAgent(id: string): Promise<Agent> {
    return this.fetchJson<Agent>(`/api/agents/${id}/clone`, { method: 'POST' });
  }

  public deleteAgent(id: string): Promise<{ success: boolean }> {
    return this.fetchJson<{ success: boolean }>(`/api/agents/${id}`, { method: 'DELETE' });
  }

  // Rooms & Messages
  public getRooms(): Promise<any[]> {
    return this.fetchJson<any[]>('/api/rooms');
  }

  public getMessages(roomId: string): Promise<Message[]> {
    return this.fetchJson<Message[]>(`/api/rooms/${roomId}/messages`);
  }

  public sendMessage(roomId: string, content: string): Promise<Message> {
    return this.fetchJson<Message>(`/api/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }

  // Tasks
  public getTasks(): Promise<Task[]> {
    return this.fetchJson<Task[]>('/api/tasks');
  }

  public retryTask(taskId: string): Promise<{ success: boolean }> {
    return this.fetchJson<{ success: boolean }>(`/api/tasks/${taskId}/retry`, { method: 'POST' });
  }

  // Approvals
  public getApprovals(status?: string): Promise<ApprovalRequest[]> {
    const q = status ? `?status=${status}` : '';
    return this.fetchJson<ApprovalRequest[]>(`/api/approvals${q}`);
  }

  public approveRequest(id: string): Promise<ApprovalRequest> {
    return this.fetchJson<ApprovalRequest>(`/api/approvals/${id}/approve`, { method: 'POST' });
  }

  public rejectRequest(id: string, reason?: string): Promise<ApprovalRequest> {
    return this.fetchJson<ApprovalRequest>(`/api/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Worktrees
  public getWorktrees(): Promise<any[]> {
    return this.fetchJson<any[]>('/api/worktrees');
  }

  // Memory
  public getMemories(): Promise<SharedMemory[]> {
    return this.fetchJson<SharedMemory[]>('/api/memory');
  }

  public createMemory(payload: any): Promise<SharedMemory> {
    return this.fetchJson<SharedMemory>('/api/memory', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public updateMemory(id: string, updates: any): Promise<SharedMemory> {
    return this.fetchJson<SharedMemory>(`/api/memory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  public deleteMemory(id: string): Promise<{ success: boolean }> {
    return this.fetchJson<{ success: boolean }>(`/api/memory/${id}`, { method: 'DELETE' });
  }

  // Costs
  public getCosts(): Promise<any> {
    return this.fetchJson<any>('/api/costs');
  }

  // Audit
  public getAuditLogs(): Promise<any[]> {
    return this.fetchJson<any[]>('/api/audit');
  }

  // Away Mode
  public getAwayMode(): Promise<{ awayModeEnabled: boolean; awaySince?: string }> {
    return this.fetchJson<{ awayModeEnabled: boolean; awaySince?: string }>('/api/away-mode');
  }

  public toggleAwayMode(): Promise<{ awayModeEnabled: boolean }> {
    return this.fetchJson<{ awayModeEnabled: boolean }>('/api/away-mode/toggle', { method: 'POST' });
  }

  // WebSocket
  public subscribeWs(listener: (event: any) => void): () => void {
    this.wsListeners.add(listener);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWs();
    }
    return () => {
      this.wsListeners.delete(listener);
    };
  }

  private connectWs(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        for (const listener of this.wsListeners) {
          listener(data);
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connectWs(), 3000);
    };
  }
}

export const api = new ApiService();
