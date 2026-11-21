import React, { useEffect, useState } from 'react';
import {
  Brain, Plus, Search, Trash2, Edit2, ShieldAlert,
  Sparkles, Check, CheckCircle2
} from 'lucide-react';
import { api, SharedMemory } from '../lib/api';

export const Memory: React.FC = () => {
  const [memories, setMemories] = useState<SharedMemory[]>([]);
  const [filterScope, setFilterScope] = useState<'ALL' | 'GLOBAL' | 'PROJECT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [newRuleText, setNewRuleText] = useState('');
  const [newScope, setNewScope] = useState<'GLOBAL' | 'PROJECT'>('GLOBAL');
  const [newCategory, setNewCategory] = useState('general');

  const loadMemories = async () => {
    try {
      const data = await api.getMemories();
      setMemories(data);
    } catch (err) {
      console.error('Failed to load shared memories:', err);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;

    await api.createMemory({
      ruleText: newRuleText.trim(),
      scope: newScope,
      category: newCategory,
      confidence: 0.98
    });

    setNewRuleText('');
    loadMemories();
  };

  const handleDeleteRule = async (id: string) => {
    await api.deleteMemory(id);
    loadMemories();
  };

  const filteredMemories = memories.filter((m) => {
    if (filterScope !== 'ALL' && m.scope !== filterScope) return false;
    if (searchQuery.trim()) {
      return m.ruleText.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Brain className="w-5 h-5 text-emerald-400" />
          <span>ការចងចាំរួមសម្រាប់ Agents ទាំងអស់ (Shared Memory Engine)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          កែ Agent តែម្នាក់ Agents ទាំងអស់ចាំភ្លាមៗ! បែងចែក Global vs Project-Scoped ជាមួយ Semantic Ranking
        </p>
      </div>

      {/* Add New Rule Card */}
      <form onSubmit={handleAddRule} className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
        <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-emerald-400" /> បន្ថែមច្បាប់ ឬទម្លាប់ថ្មីដោយផ្ទាល់ (Teach New Rule):
        </span>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newRuleText}
            onChange={(e) => setNewRuleText(e.target.value)}
            placeholder="ឧ. ឆ្លើយឱ្យខ្លី ដាក់ចម្លើយមុន, គម្រោងនេះត្រូវប្រើ pnpm..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />

          <select
            value={newScope}
            onChange={(e) => setNewScope(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value="GLOBAL">GLOBAL (គ្រប់ Agent & Projects)</option>
            <option value="PROJECT">PROJECT (តែក្នុង Project នេះ)</option>
          </select>

          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value="general">ទូទៅ (General)</option>
            <option value="coding_style">Coding Style</option>
            <option value="workflow">Workflow & Process</option>
            <option value="tool_preference">Tool Preference</option>
            <option value="security">Security Policy</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-xs font-semibold text-white shadow-md transition-all shrink-0"
          >
            បង្រៀន Agents
          </button>
        </div>
      </form>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['ALL', 'GLOBAL', 'PROJECT'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterScope(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterScope === s
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ស្វែងរកតាមពាក្យគន្លឹះ..."
            className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Rules List Grid */}
      <div className="space-y-3">
        {filteredMemories.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs bg-[#0f172a] rounded-2xl border border-slate-800">
            មិនមាន Rule ត្រូវនឹងការស្វែងរកទេ។
          </div>
        ) : (
          filteredMemories.map((rule) => (
            <div
              key={rule.id}
              className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      rule.scope === 'GLOBAL'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {rule.scope}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 uppercase">
                    {rule.category}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Confidence: {Math.round(rule.confidence * 100)}%
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    v{rule.version}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-100">{rule.ruleText}</p>
                <p className="text-[10px] text-slate-500">
                  រៀនស្វ័យប្រវត្តិតាមឆាត • {new Date(rule.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-900 border border-slate-800"
                  title="Delete Rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
