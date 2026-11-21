import { db } from '../db/index.js';
import type { SharedMemory, MemoryScope } from '../db/schema.js';

export interface ExtractedRule {
  isCorrection: boolean;
  ruleText: string;
  scope: MemoryScope;
  category: 'coding_style' | 'workflow' | 'tool_preference' | 'security' | 'general';
  confidence: number;
}

export class SharedMemoryEngine {
  private static correctionPatterns = [
    // Khmer patterns
    { regex: /(?:ឆ្លើយ|សរសេរ|និយាយ)\s*(?:ឱ្យ|ឲ្យ)\s*(?:ខ្លី|លឿន|កំបុយ|ចំ)/i, category: 'coding_style' as const },
    { regex: /(?:ដាក់|បង្ហាញ|សរសេរ)\s*ចម្លើយ\s*(?:មុន|ដំបូង)/i, category: 'general' as const },
    { regex: /(?:គម្រោងនេះ|project នេះ)\s*(?:ប្រើ|ហាមប្រើ|កុំប្រើ)\s*(.+)/i, category: 'workflow' as const },
    { regex: /(?:កុំ|ហាម)\s*(?:push|merge|delete|កែ)\s*(.+)/i, category: 'security' as const },
    { regex: /(?:ចងចាំ|ចាំទុក|កត់ទុក|ច្បាប់)\s*៖?\s*(.+)/i, category: 'general' as const },

    // English patterns
    { regex: /(?:always|never|do not|please remember to|from now on)\s+(.+)/i, category: 'workflow' as const },
    { regex: /(?:keep answers|be more|answer)\s+(?:concise|brief|short|direct)/i, category: 'coding_style' as const },
    { regex: /(?:use|don't use|prefer)\s+(?:pnpm|npm|yarn|bun|vite|vitest|jest)/i, category: 'tool_preference' as const }
  ];

  /**
   * Lightweight classifier detecting whether a user message is teaching or correcting habits.
   */
  public static detectCorrection(userMessage: string, projectId?: string): ExtractedRule | null {
    const trimmed = userMessage.trim();
    if (trimmed.length < 5 || trimmed.length > 500) return null;

    for (const item of this.correctionPatterns) {
      const match = trimmed.match(item.regex);
      if (match) {
        const isProjectSpecific = !!projectId && /(?:គម្រោងនេះ|project នេះ|repo នេះ|in this repo|for this project)/i.test(trimmed);
        return {
          isCorrection: true,
          ruleText: trimmed,
          scope: isProjectSpecific ? 'PROJECT' : 'GLOBAL',
          category: item.category,
          confidence: 0.95
        };
      }
    }

    return null;
  }

  /**
   * Store a newly detected or manually added rule with conflict detection.
   */
  public static saveLearnedRule(params: {
    userId: string;
    projectId?: string;
    ruleText: string;
    scope?: MemoryScope;
    category?: 'coding_style' | 'workflow' | 'tool_preference' | 'security' | 'general';
    sourceMessageId?: string;
    confidence?: number;
  }): { memory: SharedMemory; conflictWith?: SharedMemory } {
    const existing = db.getMemories(params.projectId);

    // Simple conflict detection: check if existing rule mentions conflicting tools or instructions
    const conflict = existing.find(m => {
      if (m.scope !== (params.scope || 'GLOBAL')) return false;
      const lowerExisting = m.ruleText.toLowerCase();
      const lowerNew = params.ruleText.toLowerCase();
      // Example conflict: npm vs pnpm
      if (lowerExisting.includes('npm') && lowerNew.includes('pnpm')) return true;
      if (lowerExisting.includes('concise') && lowerNew.includes('detailed')) return true;
      return false;
    });

    const memory = db.addMemory({
      userId: params.userId,
      projectId: params.projectId,
      scope: params.scope || 'GLOBAL',
      ruleText: params.ruleText,
      category: params.category || 'general',
      confidence: params.confidence || 0.9,
      sourceMessageId: params.sourceMessageId,
      isVerified: true
    });

    db.addAuditLog('SHARED_MEMORY_LEARNED', {
      memoryId: memory.id,
      ruleText: memory.ruleText,
      scope: memory.scope,
      conflictDetected: !!conflict
    }, undefined, params.userId);

    return { memory, conflictWith: conflict };
  }

  /**
   * Retrieve relevant rules and format into System Prompt injection block.
   */
  public static getPromptInjectionBlock(projectId?: string, currentTopicOrMessage?: string): string {
    const memories = db.getMemories(projectId);
    if (memories.length === 0) return '';

    // Score rules based on relevance to current context
    const scored = memories.map(mem => {
      let score = mem.confidence * 10;
      if (mem.scope === 'PROJECT') score += 5; // Project-scoped rules get higher priority in that project
      if (currentTopicOrMessage) {
        const words = currentTopicOrMessage.toLowerCase().split(/\s+/);
        for (const w of words) {
          if (w.length > 3 && mem.ruleText.toLowerCase().includes(w)) {
            score += 3;
          }
        }
      }
      return { mem, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topRules = scored.slice(0, 7).map(item => item.mem);

    const lines = topRules.map((r, i) => `${i + 1}. [${r.scope}] (${r.category}) ${r.ruleText}`);

    return `
[CROSS-AGENT SHARED MEMORY & LEARNED RULES]
The following rules have been learned directly from the human owner. ALL agents must strictly obey them:
${lines.join('\n')}
`.trim();
  }
}
