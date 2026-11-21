import fs from 'fs';
import path from 'path';
import { randomUUID as uuidv4 } from 'node:crypto';
import { config } from '../config/index.js';
import type {
  User, Project, Agent, Room, Message, Worktree,
  ApprovalRequest, SharedMemory, Task, TaskCheckpoint,
  AuditLog, RunnerLease
} from './schema.js';
import { OFFICIAL_CAMBODIA_AGENTS, SUPREME_ADMIN_AGENT } from '../agents/official-cambodia-agents.js';

interface DatabaseSchema {
  users: User[];
  projects: Project[];
  agents: Agent[];
  rooms: Room[];
  messages: Message[];
  worktrees: Worktree[];
  approvalRequests: ApprovalRequest[];
  sharedMemories: SharedMemory[];
  tasks: Task[];
  taskCheckpoints: TaskCheckpoint[];
  auditLogs: AuditLog[];
  runnerLeases: RunnerLease[];
}

export class Database {
  private static instance: Database;
  private filePath: string;
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    const dataDir = config.dataPath;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'angkor_db.json');
    this.data = this.load();
    if (this.data.agents.length === 0) {
      this.seedInitialData();
    }
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse database file, initializing clean database', err);
      }
    }
    return {
      users: [],
      projects: [],
      agents: [],
      rooms: [],
      messages: [],
      worktrees: [],
      approvalRequests: [],
      sharedMemories: [],
      tasks: [],
      taskCheckpoints: [],
      auditLogs: [],
      runnerLeases: []
    };
  }

  public save(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      try {
        const tempPath = `${this.filePath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
        fs.renameSync(tempPath, this.filePath);
      } catch (err) {
        console.error('Error saving database to file:', err);
      }
    }, 50);
  }

  private seedInitialData() {
    const defaultUserId = 'user-owner';
    const defaultUser: User = {
      id: defaultUserId,
      telegramId: config.allowedTelegramIds[0] || 123456789,
      username: 'angkor_master',
      awayModeEnabled: false,
      createdAt: new Date().toISOString()
    };
    this.data.users.push(defaultUser);

    const defaultProject: Project = {
      id: 'proj-angkor-core',
      userId: defaultUserId,
      name: 'my-shop',
      description: 'Main E-Commerce Application & Core Services',
      localRepoPath: process.cwd(),
      defaultBranch: 'main',
      createdAt: new Date().toISOString()
    };
    this.data.projects.push(defaultProject);

    // ០. Supreme Controller - ANGKOR EYES
    const supremeAgent: Agent = {
      id: 'agent-supreme-angkor-eyes',
      userId: defaultUserId,
      projectId: defaultProject.id,
      name: SUPREME_ADMIN_AGENT.titleKhmer,
      command: SUPREME_ADMIN_AGENT.command,
      category: SUPREME_ADMIN_AGENT.category,
      role: 'lead',
      systemPrompt: SUPREME_ADMIN_AGENT.systemPrompt,
      model: config.leadModel || 'gemini-2.5-pro',
      isLead: true,
      isSupremeAdmin: true,
      status: 'active',
      capabilities: SUPREME_ADMIN_AGENT.capabilities,
      officialWebsite: SUPREME_ADMIN_AGENT.officialWebsite,
      officialFacebook: SUPREME_ADMIN_AGENT.officialFacebook,
      avatarColor: '#10b981',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Technical Specialists
    const devAgent: Agent = {
      id: 'agent-dev-dara',
      userId: defaultUserId,
      projectId: defaultProject.id,
      name: 'Dara (Developer)',
      command: '/dara',
      category: 'core_team',
      role: 'developer',
      systemPrompt: 'You are Dara, Senior Fullstack Developer for ANGKOR EYES. You write clean, robust code inside your isolated git worktree. You write unit tests and commit to your assigned task branch. You NEVER push directly to main without explicit approval.',
      model: config.devModel,
      isLead: false,
      status: 'active',
      capabilities: {
        canPlanAndDelegate: false,
        canReadFiles: true,
        canWriteFiles: true,
        canRunTests: true,
        canCommitBranch: true,
        canMergeMain: false,
        canPushRemote: false,
        canDeploy: false
      },
      avatarColor: '#3b82f6',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const qaAgent: Agent = {
      id: 'agent-qa-bopha',
      userId: defaultUserId,
      projectId: defaultProject.id,
      name: 'Bopha (QA Automation)',
      command: '/bopha',
      category: 'core_team',
      role: 'qa',
      systemPrompt: 'You are Bopha, Quality Assurance & Test Engineer for ANGKOR EYES. You run automated test suites, verify edge cases, inspect logs, and state whether code passes (QA PASS) or needs fixes (QA FAIL).',
      model: config.defaultModel,
      isLead: false,
      status: 'active',
      capabilities: {
        canPlanAndDelegate: false,
        canReadFiles: true,
        canWriteFiles: false,
        canRunTests: true,
        canCommitBranch: false,
        canMergeMain: false,
        canPushRemote: false,
        canDeploy: false
      },
      avatarColor: '#f59e0b',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const reviewerAgent: Agent = {
      id: 'agent-rev-sok',
      userId: defaultUserId,
      projectId: defaultProject.id,
      name: 'Sok (Code Reviewer)',
      command: '/sok',
      category: 'core_team',
      role: 'reviewer',
      systemPrompt: 'You are Sok, Principal Code Reviewer and Security Specialist for ANGKOR EYES. You rigorously inspect code diffs for security vulnerabilities, memory leaks, performance bottlenecks, and adherence to clean architecture before proposing approval.',
      model: config.devModel,
      isLead: false,
      status: 'active',
      capabilities: {
        canPlanAndDelegate: false,
        canReadFiles: true,
        canWriteFiles: false,
        canRunTests: true,
        canCommitBranch: false,
        canMergeMain: false,
        canPushRemote: false,
        canDeploy: false
      },
      avatarColor: '#8b5cf6',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Seed Official Cambodia Institutional AGI Agents
    const officialAgents: Agent[] = OFFICIAL_CAMBODIA_AGENTS
      .filter(ag => ag.slug !== 'angkor_eyes')
      .map(ag => ({
        id: ag.id,
        userId: defaultUserId,
        projectId: defaultProject.id,
        name: ag.titleKhmer,
        command: ag.command,
        category: ag.category,
        role: ag.role,
        systemPrompt: ag.systemPrompt,
        model: ag.model,
        isLead: false,
        isSupremeAdmin: false,
        status: 'active',
        capabilities: ag.capabilities,
        officialWebsite: ag.officialWebsite,
        officialFacebook: ag.officialFacebook,
        avatarColor: ag.avatarColor,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

    this.data.agents.push(supremeAgent, devAgent, qaAgent, reviewerAgent, ...officialAgents);

    // Initial Rooms
    const mainRoom: Room = {
      id: 'room-main-squad',
      projectId: defaultProject.id,
      name: 'រាជរដ្ឋាភិបាលឌីជីថល / ANGKOR EYES Command',
      memberAgentIds: [supremeAgent.id, devAgent.id, qaAgent.id, reviewerAgent.id],
      activeTurnQueue: [],
      isLocked: false,
      createdAt: new Date().toISOString()
    };
    this.data.rooms.push(mainRoom);

    // Initial Welcome Message
    this.data.messages.push({
      id: 'msg-welcome-001',
      roomId: mainRoom.id,
      senderType: 'system',
      senderId: 'system',
      senderName: 'ANGKOR EYES System',
      content: '🇰🇭 ប្រព័ន្ធ AGI AGENTS **"ANGKOR EYES"** ត្រូវបានដំឡើងជោគជ័យ! ប្រធានក្រុម (Rex), Developer (Dara), QA (Bopha), និង Code Reviewer (Sok) បានត្រៀមខ្លួនរួចរាល់។',
      createdAt: new Date().toISOString()
    });

    // Initial Shared Memories / Learned Rules
    this.data.sharedMemories.push(
      {
        id: 'mem-001',
        userId: defaultUserId,
        scope: 'GLOBAL',
        ruleText: 'ឆ្លើយឱ្យខ្លី ចំគោលដៅ ដាក់ចម្លើយសំខាន់មុនគេ និងពន្យល់ជាភាសាខ្មែរបើអ្នកប្រើសួរជាភាសាខ្មែរ។',
        category: 'general',
        confidence: 0.98,
        version: 1,
        isVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mem-002',
        userId: defaultUserId,
        projectId: defaultProject.id,
        scope: 'PROJECT',
        ruleText: 'គម្រោងនេះត្រូវប្រើ TypeScript, Vitest សម្រាប់ test, និងហាម push ទៅ main ដោយគ្មាន review pass។',
        category: 'workflow',
        confidence: 0.99,
        version: 1,
        isVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    );

    this.save();
  }

  // --- Users ---
  public getUsers(): User[] { return this.data.users; }
  public getUserById(id: string): User | undefined { return this.data.users.find(u => u.id === id); }
  public getUserByTelegramId(tid: number): User | undefined { return this.data.users.find(u => u.telegramId === tid); }
  public upsertUser(user: User): User {
    const idx = this.data.users.findIndex(u => u.id === user.id || u.telegramId === user.telegramId);
    if (idx >= 0) {
      this.data.users[idx] = { ...this.data.users[idx], ...user };
    } else {
      this.data.users.push(user);
    }
    this.save();
    return user;
  }

  // --- Projects ---
  public getProjects(): Project[] { return this.data.projects; }
  public getProjectById(id: string): Project | undefined { return this.data.projects.find(p => p.id === id); }
  public createProject(project: Omit<Project, 'id' | 'createdAt'>): Project {
    const newProj: Project = { ...project, id: uuidv4(), createdAt: new Date().toISOString() };
    this.data.projects.push(newProj);
    this.save();
    return newProj;
  }

  // --- Agents ---
  public getAgents(projectId?: string): Agent[] {
    if (projectId) return this.data.agents.filter(a => a.projectId === projectId);
    return this.data.agents;
  }
  public getAgentById(id: string): Agent | undefined { return this.data.agents.find(a => a.id === id); }
  public getLeadAgent(projectId?: string): Agent | undefined {
    return this.data.agents.find(a => a.isLead && (!projectId || a.projectId === projectId)) || this.data.agents.find(a => a.isLead);
  }
  public createAgent(agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Agent {
    const now = new Date().toISOString();
    const newAgent: Agent = {
      ...agent,
      id: `agent-${uuidv4().substring(0, 8)}`,
      createdAt: now,
      updatedAt: now
    };
    this.data.agents.push(newAgent);
    this.save();
    return newAgent;
  }
  public updateAgent(id: string, updates: Partial<Agent>): Agent | null {
    const idx = this.data.agents.findIndex(a => a.id === id);
    if (idx === -1) return null;
    this.data.agents[idx] = { ...this.data.agents[idx], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.data.agents[idx];
  }
  public deleteAgent(id: string): boolean {
    const initialLen = this.data.agents.length;
    this.data.agents = this.data.agents.filter(a => a.id !== id);
    if (this.data.agents.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Rooms ---
  public getRooms(projectId?: string): Room[] {
    if (projectId) return this.data.rooms.filter(r => r.projectId === projectId);
    return this.data.rooms;
  }
  public getRoomById(id: string): Room | undefined { return this.data.rooms.find(r => r.id === id); }
  public createRoom(room: Omit<Room, 'id' | 'createdAt' | 'activeTurnQueue' | 'isLocked'>): Room {
    const newRoom: Room = {
      ...room,
      id: `room-${uuidv4().substring(0, 8)}`,
      activeTurnQueue: [],
      isLocked: false,
      createdAt: new Date().toISOString()
    };
    this.data.rooms.push(newRoom);
    this.save();
    return newRoom;
  }
  public updateRoom(id: string, updates: Partial<Room>): Room | null {
    const idx = this.data.rooms.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.data.rooms[idx] = { ...this.data.rooms[idx], ...updates };
    this.save();
    return this.data.rooms[idx];
  }

  // --- Messages ---
  public getMessages(roomId: string, limit = 100): Message[] {
    return this.data.messages
      .filter(m => m.roomId === roomId)
      .slice(-limit);
  }
  public addMessage(msg: Omit<Message, 'id' | 'createdAt'>): Message {
    const newMsg: Message = {
      ...msg,
      id: `msg-${uuidv4().substring(0, 10)}`,
      createdAt: new Date().toISOString()
    };
    this.data.messages.push(newMsg);
    this.save();
    return newMsg;
  }

  // --- Worktrees ---
  public getWorktrees(projectId?: string): Worktree[] {
    if (projectId) return this.data.worktrees.filter(w => w.projectId === projectId);
    return this.data.worktrees;
  }
  public getWorktreeById(id: string): Worktree | undefined { return this.data.worktrees.find(w => w.id === id); }
  public getWorktreeByAgentAndTask(agentId: string, taskId: string): Worktree | undefined {
    return this.data.worktrees.find(w => w.agentId === agentId && w.taskId === taskId && w.status === 'active');
  }
  public addWorktree(wt: Omit<Worktree, 'id' | 'createdAt'>): Worktree {
    const newWt: Worktree = { ...wt, id: `wt-${uuidv4().substring(0, 8)}`, createdAt: new Date().toISOString() };
    this.data.worktrees.push(newWt);
    this.save();
    return newWt;
  }
  public updateWorktree(id: string, updates: Partial<Worktree>): Worktree | null {
    const idx = this.data.worktrees.findIndex(w => w.id === id);
    if (idx === -1) return null;
    this.data.worktrees[idx] = { ...this.data.worktrees[idx], ...updates };
    this.save();
    return this.data.worktrees[idx];
  }

  // --- Approvals ---
  public getApprovalRequests(status?: string): ApprovalRequest[] {
    if (status) return this.data.approvalRequests.filter(a => a.status === status);
    return this.data.approvalRequests;
  }
  public getApprovalById(id: string): ApprovalRequest | undefined {
    return this.data.approvalRequests.find(a => a.id === id);
  }
  public createApprovalRequest(req: Omit<ApprovalRequest, 'id' | 'createdAt' | 'status'>): ApprovalRequest {
    const newReq: ApprovalRequest = {
      ...req,
      id: `apr-${uuidv4().substring(0, 8)}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.data.approvalRequests.push(newReq);
    this.save();
    return newReq;
  }
  public updateApproval(id: string, updates: Partial<ApprovalRequest>): ApprovalRequest | null {
    const idx = this.data.approvalRequests.findIndex(a => a.id === id);
    if (idx === -1) return null;
    this.data.approvalRequests[idx] = { ...this.data.approvalRequests[idx], ...updates };
    this.save();
    return this.data.approvalRequests[idx];
  }

  // --- Shared Memory ---
  public getMemories(projectId?: string): SharedMemory[] {
    return this.data.sharedMemories.filter(m => m.scope === 'GLOBAL' || (projectId && m.projectId === projectId));
  }
  public addMemory(mem: Omit<SharedMemory, 'id' | 'createdAt' | 'updatedAt' | 'version'>): SharedMemory {
    const now = new Date().toISOString();
    const newMem: SharedMemory = {
      ...mem,
      id: `mem-${uuidv4().substring(0, 8)}`,
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    this.data.sharedMemories.push(newMem);
    this.save();
    return newMem;
  }
  public updateMemory(id: string, updates: Partial<SharedMemory>): SharedMemory | null {
    const idx = this.data.sharedMemories.findIndex(m => m.id === id);
    if (idx === -1) return null;
    this.data.sharedMemories[idx] = {
      ...this.data.sharedMemories[idx],
      ...updates,
      version: this.data.sharedMemories[idx].version + 1,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data.sharedMemories[idx];
  }
  public deleteMemory(id: string): boolean {
    const init = this.data.sharedMemories.length;
    this.data.sharedMemories = this.data.sharedMemories.filter(m => m.id !== id);
    if (this.data.sharedMemories.length !== init) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Tasks ---
  public getTasks(projectId?: string): Task[] {
    if (projectId) return this.data.tasks.filter(t => t.projectId === projectId);
    return this.data.tasks;
  }
  public getTaskById(id: string): Task | undefined { return this.data.tasks.find(t => t.id === id); }
  public createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...task,
      id: `task-${uuidv4().substring(0, 8)}`,
      createdAt: now,
      updatedAt: now
    };
    this.data.tasks.push(newTask);
    this.save();
    return newTask;
  }
  public updateTask(id: string, updates: Partial<Task>): Task | null {
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.data.tasks[idx] = { ...this.data.tasks[idx], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.data.tasks[idx];
  }

  // --- Checkpoints ---
  public addCheckpoint(taskId: string, stepIndex: number, snapshot: Record<string, any>): TaskCheckpoint {
    const cp: TaskCheckpoint = {
      id: `cp-${uuidv4().substring(0, 8)}`,
      taskId,
      stepIndex,
      stateSnapshot: snapshot,
      createdAt: new Date().toISOString()
    };
    this.data.taskCheckpoints.push(cp);
    this.save();
    return cp;
  }
  public getCheckpoints(taskId: string): TaskCheckpoint[] {
    return this.data.taskCheckpoints.filter(cp => cp.taskId === taskId).sort((a, b) => b.stepIndex - a.stepIndex);
  }

  // --- Audit Logs ---
  public addAuditLog(eventType: string, details: Record<string, any>, agentId?: string, userId?: string): AuditLog {
    const log: AuditLog = {
      id: `aud-${uuidv4().substring(0, 8)}`,
      eventType,
      agentId,
      userId,
      details,
      createdAt: new Date().toISOString()
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs.pop(); // keep latest 1000 logs
    }
    this.save();
    return log;
  }
  public getAuditLogs(limit = 100): AuditLog[] {
    return this.data.auditLogs.slice(0, limit);
  }

  // --- Runner Leases ---
  public updateRunnerHeartbeat(runnerId: string, systemStats?: any): RunnerLease {
    let lease = this.data.runnerLeases.find(r => r.runnerId === runnerId);
    const now = new Date().toISOString();
    if (lease) {
      lease.lastHeartbeat = now;
      lease.status = 'online';
      if (systemStats) lease.systemStats = systemStats;
    } else {
      lease = {
        id: `lease-${uuidv4().substring(0, 6)}`,
        runnerId,
        status: 'online',
        lastHeartbeat: now,
        activeWorktreesCount: 0,
        systemStats
      };
      this.data.runnerLeases.push(lease);
    }
    this.save();
    return lease;
  }
  public getRunnerLeases(): RunnerLease[] {
    const now = Date.now();
    // Mark runners offline if heartbeat > 30s
    this.data.runnerLeases.forEach(r => {
      const diff = now - new Date(r.lastHeartbeat).getTime();
      if (diff > 30000) {
        r.status = 'offline';
      }
    });
    return this.data.runnerLeases;
  }
}

export const db = Database.getInstance();
