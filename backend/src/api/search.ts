import { db } from '../db/index.js';

export interface SearchResults {
  query: string;
  messages: any[];
  memories: any[];
  tasks: any[];
  approvals: any[];
  agents: any[];
  totalMatches: number;
}

export class UnifiedSearchEngine {
  public static search(query: string, limit = 20): SearchResults {
    const q = query.toLowerCase().trim();
    if (!q) {
      return { query, messages: [], memories: [], tasks: [], approvals: [], agents: [], totalMatches: 0 };
    }

    const messages = db.getRooms()
      .flatMap(r => db.getMessages(r.id, 200))
      .filter(m => m.content.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q))
      .slice(0, limit);

    const memories = db.getMemories()
      .filter(m => m.ruleText.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
      .slice(0, limit);

    const tasks = db.getTasks()
      .filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
      .slice(0, limit);

    const approvals = db.getApprovalRequests()
      .filter(a => a.summary.toLowerCase().includes(q) || a.branchName.toLowerCase().includes(q))
      .slice(0, limit);

    const agents = db.getAgents()
      .filter(a => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q) || (a.command && a.command.toLowerCase().includes(q)))
      .slice(0, limit);

    const totalMatches = messages.length + memories.length + tasks.length + approvals.length + agents.length;

    return {
      query,
      messages,
      memories,
      tasks,
      approvals,
      agents,
      totalMatches
    };
  }
}
