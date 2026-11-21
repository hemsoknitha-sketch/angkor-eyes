import React, { useEffect, useState } from 'react';
import { Coins, TrendingUp, Cpu, Users, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';

export const CostCenter: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    api.getCosts().then(setMetrics).catch(console.error);
  }, []);

  if (!metrics) {
    return <div className="p-8 text-center text-slate-500 text-xs">កំពុងផ្ទុកទិន្នន័យ Tokens & Cost...</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Coins className="w-5 h-5 text-amber-400" />
          <span>ការប្រើប្រាស់ & គ្រប់គ្រងថ្លៃដើម (AI Usage & Cost Center)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          តាមដាន Token Usage, ថ្លៃប៉ាន់ស្មានតាម Agent និង Model Routing
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400">Total Tokens Processed</span>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            {metrics.totalTokens?.toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-400">Prompt Caching Optimized</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400">Estimated Cost (USD)</span>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            ${metrics.totalCostUSD}
          </div>
          <p className="text-[11px] text-slate-500">Based on active provider pricing</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400">Monthly Budget Target</span>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            ${metrics.monthlyBudgetUSD}.00
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(metrics.budgetUsedPercent || 1, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 font-mono">{metrics.budgetUsedPercent}% used this month</p>
        </div>
      </div>

      {/* Model & Agent Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model Breakdown */}
        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-200">ការបែងចែកតាម Model (Model Routing)</h3>
          </div>

          <div className="space-y-3">
            {Object.entries(metrics.modelBreakdown || {}).map(([modelName, data]: [string, any]) => (
              <div key={modelName} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono font-bold text-slate-200">{modelName}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{data.tokens?.toLocaleString()} tokens</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-amber-400">${data.costUSD}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Breakdown */}
        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-200">ការបែងចែកតាម Agent</h3>
          </div>

          <div className="space-y-3">
            {Object.entries(metrics.agentBreakdown || {}).map(([agentName, data]: [string, any]) => (
              <div key={agentName} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-200">{agentName}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{data.tokens?.toLocaleString()} tokens</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-amber-400">${data.costUSD}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
