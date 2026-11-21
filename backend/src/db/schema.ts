export type AgentRole = 'lead' | 'developer' | 'qa' | 'reviewer' | 'security' | 'custom';
export type AgentStatus = 'active' | 'paused' | 'busy';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type ActionType = 'git_push' | 'merge_main' | 'delete_file' | 'deploy' | 'custom_risky';
export type MemoryScope = 'GLOBAL' | 'PROJECT';
export type TaskStatus = 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';

export interface User {
  id: string;
  telegramId: number;
  username: string;
  awayModeEnabled: boolean;
  awaySince?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  localRepoPath: string;
  defaultBranch: string;
  runnerId?: string;
  createdAt: string;
}

export interface AgentCapability {
  canPlanAndDelegate: boolean;
  canReadFiles: boolean;
  canWriteFiles: boolean;
  canRunTests: boolean;
  canCommitBranch: boolean;
  canMergeMain: boolean;
  canPushRemote: boolean;
  canDeploy: boolean;
}

export interface Agent {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  role: AgentRole;
  systemPrompt: string;
  model: string;
  isLead: boolean;
  status: AgentStatus;
  capabilities: AgentCapability;
  command?: string;
  category?: string;
  officialWebsite?: string;
  officialFacebook?: string;
  isSupremeAdmin?: boolean;
  avatarColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  projectId: string;
  name: string;
  topicId?: number;
  memberAgentIds: string[];
  activeTurnQueue: string[]; // Agent IDs waiting to speak
  currentSpeakerId?: string;
  isLocked: boolean;
  createdAt: string;
}

export interface MessageMetadata {
  toolCalls?: Array<{
    toolName: string;
    args: Record<string, any>;
    result?: string;
    status: 'success' | 'error';
  }>;
  filesChanged?: Array<{
    filePath: string;
    additions: number;
    deletions: number;
  }>;
  diffSnippet?: string;
  approvalId?: string;
  mentions?: string[];
  replyToMessageId?: string;
  reasoningBrief?: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderType: 'human' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  content: string;
  metadata?: MessageMetadata;
  createdAt: string;
}

export interface Worktree {
  id: string;
  projectId: string;
  agentId: string;
  taskId: string;
  branchName: string;
  worktreePath: string;
  baseCommitSha: string;
  status: 'active' | 'merged' | 'pruned';
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  roomId: string;
  agentId: string;
  taskId?: string;
  actionType: ActionType;
  summary: string;
  diffPayload?: string;
  actionHash: string; // TOCTOU verification hash
  targetRepo: string;
  branchName: string;
  targetCommitSha: string;
  status: ApprovalStatus;
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
  scope: MemoryScope;
  ruleText: string;
  category: 'coding_style' | 'workflow' | 'tool_preference' | 'security' | 'general';
  confidence: number;
  version: number;
  embedding?: number[];
  sourceMessageId?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DAGNode {
  id: string;
  agentRole: AgentRole;
  agentId?: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval';
  dependencies: string[]; // node IDs that must finish first
  output?: string;
  error?: string;
}

export interface Task {
  id: string;
  projectId: string;
  roomId: string;
  leadAgentId: string;
  title: string;
  description: string;
  status: TaskStatus;
  dag: DAGNode[];
  currentStep: number;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCheckpoint {
  id: string;
  taskId: string;
  stepIndex: number;
  stateSnapshot: Record<string, any>;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  eventType: string;
  agentId?: string;
  userId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface RunnerLease {
  id: string;
  runnerId: string;
  status: 'online' | 'busy' | 'offline';
  lastHeartbeat: string;
  activeWorktreesCount: number;
  systemStats?: {
    platform: string;
    cpuUsage: number;
    ramUsageMB: number;
    gitVersion: string;
  };
}
