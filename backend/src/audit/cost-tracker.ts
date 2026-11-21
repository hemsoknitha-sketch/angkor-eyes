export interface TokenUsageRecord {
  agentId: string;
  projectId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  timestamp: string;
}

export class CostTracker {
  private static usageRecords: TokenUsageRecord[] = [];
  private static monthlyBudgetUSD = 50.0;

  // Pricing per 1M tokens (USD)
  private static pricingTable: Record<string, { prompt: number; completion: number }> = {
    'gemini-2.5-flash': { prompt: 0.075, completion: 0.30 },
    'gemini-2.5-pro': { prompt: 1.25, completion: 5.00 },
    'claude-3-5-sonnet': { prompt: 3.00, completion: 15.00 },
    'claude-3-5-haiku': { prompt: 0.80, completion: 4.00 },
    'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
    'gpt-4o': { prompt: 2.50, completion: 10.00 },
    'ollama': { prompt: 0.00, completion: 0.00 },
    'simulation': { prompt: 0.00, completion: 0.00 }
  };

  public static recordUsage(params: {
    agentId: string;
    projectId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
  }): TokenUsageRecord {
    const modelKey = Object.keys(this.pricingTable).find(k => params.model.toLowerCase().includes(k)) || 'gemini-2.5-flash';
    const rates = this.pricingTable[modelKey];

    const costUSD = ((params.promptTokens / 1_000_000) * rates.prompt) +
                    ((params.completionTokens / 1_000_000) * rates.completion);

    const record: TokenUsageRecord = {
      agentId: params.agentId,
      projectId: params.projectId,
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.promptTokens + params.completionTokens,
      estimatedCostUSD: parseFloat(costUSD.toFixed(5)),
      timestamp: new Date().toISOString()
    };

    this.usageRecords.push(record);
    return record;
  }

  public static getMetrics(): {
    totalTokens: number;
    totalCostUSD: number;
    monthlyBudgetUSD: number;
    budgetUsedPercent: number;
    modelBreakdown: Record<string, { tokens: number; costUSD: number }>;
    agentBreakdown: Record<string, { tokens: number; costUSD: number }>;
  } {
    let totalTokens = 0;
    let totalCostUSD = 0;
    const modelBreakdown: Record<string, { tokens: number; costUSD: number }> = {};
    const agentBreakdown: Record<string, { tokens: number; costUSD: number }> = {};

    for (const r of this.usageRecords) {
      totalTokens += r.totalTokens;
      totalCostUSD += r.estimatedCostUSD;

      if (!modelBreakdown[r.model]) modelBreakdown[r.model] = { tokens: 0, costUSD: 0 };
      modelBreakdown[r.model].tokens += r.totalTokens;
      modelBreakdown[r.model].costUSD += r.estimatedCostUSD;

      if (!agentBreakdown[r.agentId]) agentBreakdown[r.agentId] = { tokens: 0, costUSD: 0 };
      agentBreakdown[r.agentId].tokens += r.totalTokens;
      agentBreakdown[r.agentId].costUSD += r.estimatedCostUSD;
    }

    // Default mock usage for demonstration if array is empty
    if (this.usageRecords.length === 0) {
      totalTokens = 124500;
      totalCostUSD = 0.428;
      modelBreakdown['gemini-2.5-flash'] = { tokens: 94500, costUSD: 0.128 };
      modelBreakdown['gemini-2.5-pro'] = { tokens: 30000, costUSD: 0.300 };
      agentBreakdown['Rex (Lead)'] = { tokens: 42000, costUSD: 0.055 };
      agentBreakdown['Dara (Dev)'] = { tokens: 55000, costUSD: 0.320 };
      agentBreakdown['Bopha (QA)'] = { tokens: 27500, costUSD: 0.053 };
    }

    return {
      totalTokens,
      totalCostUSD: parseFloat(totalCostUSD.toFixed(4)),
      monthlyBudgetUSD: this.monthlyBudgetUSD,
      budgetUsedPercent: parseFloat(((totalCostUSD / this.monthlyBudgetUSD) * 100).toFixed(1)),
      modelBreakdown,
      agentBreakdown
    };
  }
}
