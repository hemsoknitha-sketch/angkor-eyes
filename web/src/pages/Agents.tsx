import React, { useEffect, useState } from 'react';
import {
  Users, UserPlus, Play, Pause, Copy, Trash2,
  Edit2, Check, Shield, Sparkles, X, Globe, Crown, Search
} from 'lucide-react';
import { api, Agent } from '../lib/api';

export const Agents: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState('developer');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [command, setCommand] = useState('');
  const [officialWebsite, setOfficialWebsite] = useState('');
  const [officialFacebook, setOfficialFacebook] = useState('');

  const loadAgents = async () => {
    try {
      const [ag, pr] = await Promise.all([api.getAgents(), api.getPresets()]);
      setAgents(ag);
      setPresets(pr);
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleOpenAddModal = (preset?: any) => {
    setEditingAgent(null);
    if (preset) {
      setSelectedPresetId(preset.id);
      setName(preset.name);
      setRole(preset.role);
      setModel(preset.model);
      setSystemPrompt(preset.systemPrompt);
      setCommand(preset.command || '');
      setOfficialWebsite(preset.officialWebsite || '');
      setOfficialFacebook(preset.officialFacebook || '');
    } else {
      setSelectedPresetId('');
      setName('');
      setRole('developer');
      setModel('gemini-2.5-flash');
      setCommand('/myagent');
      setOfficialWebsite('');
      setOfficialFacebook('');
      setSystemPrompt('You are an autonomous AI Agent in ANGKOR EYES.');
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ag: Agent) => {
    setEditingAgent(ag);
    setSelectedPresetId('');
    setName(ag.name);
    setRole(ag.role);
    setModel(ag.model);
    setSystemPrompt(ag.systemPrompt);
    setCommand(ag.command || '');
    setOfficialWebsite(ag.officialWebsite || '');
    setOfficialFacebook(ag.officialFacebook || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingAgent) {
        await api.updateAgent(editingAgent.id, {
          name,
          role,
          model,
          systemPrompt,
          command,
          officialWebsite,
          officialFacebook
        });
      } else {
        await api.createAgent({
          userId: 'user-owner',
          projectId: 'proj-angkor-core',
          name,
          role,
          model,
          systemPrompt,
          command,
          officialWebsite,
          officialFacebook
        });
      }
      setIsModalOpen(false);
      loadAgents();
    } catch (err) {
      console.error('Failed to save agent:', err);
    }
  };

  const handleTogglePause = async (id: string) => {
    await api.togglePauseAgent(id);
    loadAgents();
  };

  const handleClone = async (id: string) => {
    await api.cloneAgent(id);
    loadAgents();
  };

  const handleDelete = async (id: string) => {
    if (confirm('តើអ្នកប្រាកដជាចង់លុប Agent នេះទេ?')) {
      await api.deleteAgent(id);
      loadAgents();
    }
  };

  const categories = [
    { id: 'ALL', labelKhmer: 'ទាំងអស់ (All)' },
    { id: 'supreme_controller', labelKhmer: '👑 Supreme Command' },
    { id: 'supreme_institution', labelKhmer: '🏛️ ស្ថាប័នកំពូល' },
    { id: 'ministry', labelKhmer: '🏢 ក្រសួងទាំង ២៨' },
    { id: 'general_department', labelKhmer: '👮 អគ្គនាយកដ្ឋាន & នគរបាល' },
    { id: 'capital_province', labelKhmer: '📍 រាជធានី-ខេត្តទាំង ២៥' },
    { id: 'municipality_khan', labelKhmer: '🏙️ ក្រុង-ខណ្ឌ' }
  ];

  const filteredAgents = agents.filter(ag => {
    if (selectedCategory !== 'ALL' && ag.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        ag.name.toLowerCase().includes(q) ||
        (ag.command && ag.command.toLowerCase().includes(q)) ||
        (ag.officialWebsite && ag.officialWebsite.toLowerCase().includes(q)) ||
        ag.role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>បញ្ជីរាយនាម AGI Agents (Official Cambodian AGI Roster)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            គ្រប់គ្រងដោយ <strong className="text-emerald-400">/angkor_eyes (Supreme Command)</strong> • រួមបញ្ចូលស្ថាប័នកំពូល ក្រសួងទាំង ២៨ អគ្គនាយកដ្ឋាន និងរដ្ឋបាលរាជធានី-ខេត្ត
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-emerald-500/20 shadow-md transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Agent</span>
        </button>
      </div>

      {/* Category Pills & Search Filter */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === c.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {c.labelKhmer}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ស្វែងរកតាមឈ្មោះក្រសួង ពាក្យបញ្ជា (ឧ. /interior, /mef, /police, /phnompenh) ឬគេហទំព័រ .gov.kh..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((ag) => {
          const isPaused = ag.status === 'paused';
          const isSupreme = ag.isSupremeAdmin || ag.command === '/angkor_eyes';

          return (
            <div
              key={ag.id}
              className={`p-5 rounded-2xl bg-[#0f172a] border transition-all space-y-3.5 relative overflow-hidden ${
                isSupreme
                  ? 'border-emerald-500/60 shadow-emerald-500/10 shadow-lg bg-gradient-to-b from-emerald-950/20 to-[#0f172a]'
                  : isPaused
                  ? 'border-slate-800/60 opacity-60'
                  : 'border-slate-800 hover:border-slate-700 shadow-sm'
              }`}
            >
              {isSupreme && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500 to-teal-600 text-slate-950 font-extrabold text-[9px] px-3 py-0.5 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <Crown className="w-3 h-3 fill-slate-950" />
                  <span>Supreme Sovereign</span>
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0"
                    style={{ backgroundColor: ag.avatarColor || '#3b82f6' }}
                  >
                    {isSupreme ? <Crown className="w-5 h-5 text-amber-300" /> : ag.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                      <span>{ag.name}</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {ag.command && (
                        <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          {ag.command}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono uppercase">{ag.role}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTogglePause(ag.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    title={isPaused ? 'Resume Agent' : 'Pause (Save tokens)'}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(ag)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    title="Edit Agent"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleClone(ag.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    title="Clone Agent"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {!ag.isLead && !isSupreme && (
                    <button
                      onClick={() => handleDelete(ag.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
                      title="Delete Agent"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Official Badges (Website & Facebook) */}
              {(ag.officialWebsite || ag.officialFacebook) && (
                <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
                  {ag.officialWebsite && (
                    <span className="flex items-center gap-1 text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md">
                      <Globe className="w-3 h-3" />
                      <span>{ag.officialWebsite}</span>
                    </span>
                  )}
                  {ag.officialFacebook && (
                    <span className="text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                      FB: {ag.officialFacebook}
                    </span>
                  )}
                </div>
              )}

              {/* System Prompt Snippet */}
              <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 font-mono text-[11px]">
                {ag.systemPrompt}
              </p>

              {/* Footer info: Model & Capabilities */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="text-emerald-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {ag.model}
                </span>
                <span className={ag.capabilities?.canDeploy || isSupreme ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {isSupreme ? '⚡ Full Sovereign Power' : 'Protected Execution'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0f172a] border border-slate-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>{editingAgent ? 'កែប្រែ AGI Agent' : 'បង្កើត AGI Agent ថ្មី'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">ចំណងជើង Agent (Title):</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ឧ. AGI ក្រសួងមហាផ្ទៃ, AGI រដ្ឋបាលខេត្តសៀមរាប"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">ពាក្យបញ្ជា (Command):</label>
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="ឧ. /interior, /police, /phnompenh"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Model:</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (លឿន & សន្សំ)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (ឆ្លាតវៃ & វិភាគកម្រិតខ្ពស់)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="ollama/qwen2.5-coder">Ollama Local (Offline)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">គេហទំព័រផ្លូវការ (Website):</label>
                  <input
                    type="text"
                    value={officialWebsite}
                    onChange={(e) => setOfficialWebsite(e.target.value)}
                    placeholder="ឧ. interior.gov.kh"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">ទំព័រហ្វេសប៊ុក (Facebook Page):</label>
                  <input
                    type="text"
                    value={officialFacebook}
                    onChange={(e) => setOfficialFacebook(e.target.value)}
                    placeholder="ឧ. Ministry of Interior - ក្រសួងមហាផ្ទៃ"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">System Prompt & បេសកកម្ម:</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={4}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-semibold text-white shadow-md hover:from-emerald-500 hover:to-teal-500"
                >
                  {editingAgent ? 'រក្សាទុកការកែប្រែ' : 'បង្កើត AGI Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

                </div>
              </div>

              {/* Model Tag */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Model:</span>
                <span className="font-mono text-emerald-300 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                  {ag.model}
                </span>
                <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded ${isPaused ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {ag.status.toUpperCase()}
                </span>
              </div>

              {/* System Prompt Snippet */}
              <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 font-mono text-[11px]">
                {ag.systemPrompt}
              </p>

              {/* Capabilities checklist */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                <span className={ag.capabilities?.canReadFiles ? 'text-emerald-400' : 'text-slate-600'}>
                  ✓ Read
                </span>
                <span className={ag.capabilities?.canWriteFiles ? 'text-emerald-400' : 'text-slate-600'}>
                  {ag.capabilities?.canWriteFiles ? '✓ Write' : '✗ No Write'}
                </span>
                <span className={ag.capabilities?.canRunTests ? 'text-emerald-400' : 'text-slate-600'}>
                  {ag.capabilities?.canRunTests ? '✓ Test' : '✗ No Test'}
                </span>
                <span className={ag.capabilities?.canMergeMain ? 'text-emerald-400' : 'text-slate-600'}>
                  {ag.capabilities?.canMergeMain ? '✓ Merge' : '✗ No Merge'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0f172a] border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>{editingAgent ? 'កែប្រែ Agent' : 'បង្កើត Agent ថ្មី (Add Agent)'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">ឈ្មោះ Agent (Name):</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ឧ. Dara (Dev), Bopha (QA)"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">តួនាទី (Role):</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="developer">Developer</option>
                    <option value="qa">QA Automation</option>
                    <option value="reviewer">Code Reviewer</option>
                    <option value="security">Security Auditor</option>
                    <option value="lead">Lead Agent</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Model:</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (លឿន & សន្សំ)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (ខ្លាំង & កូដស្មុគស្មាញ)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="ollama/qwen2.5-coder">Ollama Local (Offline & Free)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">System Prompt:</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={4}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-semibold text-white shadow-md hover:from-emerald-500 hover:to-teal-500"
                >
                  {editingAgent ? 'រក្សាទុកការកែប្រែ' : 'បង្កើត Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
