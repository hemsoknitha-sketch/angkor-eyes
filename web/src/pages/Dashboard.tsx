import React, { useEffect, useState } from 'react';
import {
  Cpu, Users, ListTodo, AlertTriangle, Play,
  CheckCircle2, ArrowRight, Shield, Zap, Sparkles, Clock
} from 'lucide-react';
import { api, SystemStatus, ApprovalRequest, Task } from '../lib/api';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [s, a, t] = await Promise.all([
        api.getStatus(),
        api.getApprovals('pending'),
        api.getTasks()
      ]);
      setStatus(s);
      setApprovals(a);
      setTasks(t);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = api.subscribeWs((event) => {
      if (event.type === 'APPROVAL_REQUIRED' || event.type === 'APPROVAL_UPDATED' || event.type === 'TASK_PROGRESS') {
        loadData();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (id: string) => {
    await api.approveRequest(id);
    loadData();
  };

  const handleReject = async (id: string) => {
    await api.rejectRequest(id, 'Rejected from Dashboard');
    loadData();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Back / Away Mode Alert Banner */}
      {status?.awayModeEnabled && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/70 via-indigo-950/50 to-slate-900 border border-purple-500/40 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Clock className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-purple-200">
                🌙 Away Mode កំពុងដំណើរការស្វ័យប្រវត្តិ (Autonomous Loop Active)
              </h3>
              <p className="text-xs text-purple-300/80">
                ក្រុម AI កំពុងដោះស្រាយ Tasks ដោយស្ងាត់ស្ងៀម។ រាល់សកម្មភាព Risky នឹងត្រូវផ្អាកទុក។
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('chat')}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
          >
            <span>ពិនិត្យ Timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top 4 KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Runner Status Card */}
        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Runner Status</span>
            <div className={`w-2.5 h-2.5 rounded-full ${status?.runnerStatus === 'Online' ? 'bg-emerald-400 shadow-emerald-400/50 shadow-md animate-ping' : 'bg-amber-400'}`} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${status?.runnerStatus === 'Online' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {status?.runnerStatus || 'Standby'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Local Daemon & Sandboxed Shell</p>
        </div>

        {/* Active Agents Card */}
        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Agents</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">
              {String(status?.activeAgentsCount || 0).padStart(2, '0')}
            </span>
            <span className="text-xs text-slate-500">/ {status?.totalAgentsCount || 4} total</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Rex Lead, Dev, QA, Reviewer</p>
        </div>

        {/* Pending Tasks Card */}
        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">In-Flight Tasks</span>
            <ListTodo className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">
              {String(status?.pendingTasksCount || 0).padStart(2, '0')}
            </span>
            <span className="text-xs text-blue-400">active DAGs</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Decomposed & Turn-Taking</p>
        </div>

        {/* Pending Approvals Card */}
        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending Approvals</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${status?.pendingApprovalsCount ? 'text-amber-400' : 'text-slate-100'}`}>
              {String(status?.pendingApprovalsCount || 0).padStart(2, '0')}
            </span>
            <span className="text-xs text-amber-400">Human-in-the-loop</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">TOCTOU Cryptographic Gate</p>
        </div>
      </div>

      {/* Pending Approvals Action Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-200">
              ⚠️ សំណើរង់ចាំការអនុញ្ញាត (Pending Human Approvals)
            </h2>
          </div>
          <button
            onClick={() => onNavigate('git')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
          >
            <span>មើល Code Diff ពេញលេញ</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {approvals.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#0f172a]/60 border border-slate-800/80 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">
              គ្មានសំណើរង់ចាំការអនុញ្ញាតឡើយ។ ប្រព័ន្ធមានសុវត្ថិភាព និងដំណើរការរលូន!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-[#0f172a] border border-amber-500/30 hover:border-amber-500/50 transition-all shadow-md space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono uppercase">
                        {req.actionType}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Branch: <strong className="text-slate-200">{req.branchName}</strong>
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-200 mt-1">{req.summary}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Target Commit: {req.targetCommitSha} | Hash: {req.actionHash.substring(0, 16)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleReject(req.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-300 font-medium transition-all"
                    >
                      Not yet
                    </button>
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs text-white font-semibold shadow-emerald-500/20 shadow-md transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Merge</span>
                    </button>
                  </div>
                </div>

                {req.diffPayload && (
                  <pre className="text-[11px] p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-emerald-300 overflow-x-auto max-h-32">
                    {req.diffPayload}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Launch & Task DAG Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dynamic Task DAG Viewer */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-200">
                ផែនការការងារសកម្ម (Dynamic Task DAG)
              </h3>
            </div>
            <button
              onClick={() => onNavigate('chat')}
              className="text-xs text-emerald-400 hover:underline"
            >
              បើក Group Chat
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              មិនទាន់មាន Task ដំណើរការទេ។ ឆាតទៅកាន់ Lead Agent ដើម្បីចាប់ផ្តើម។
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.slice(-2).map((t) => (
                <div key={t.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{t.title}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t.status}
                    </span>
                  </div>

                  {/* DAG Step Progress Bar */}
                  <div className="grid grid-cols-3 gap-2">
                    {t.dag.map((node, idx) => {
                      const isDone = node.status === 'completed';
                      return (
                        <div
                          key={node.id}
                          className={`p-2.5 rounded-lg border text-xs transition-all ${
                            isDone
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                            {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Clock className="w-3.5 h-3.5 text-slate-500" />}
                            <span>{node.agentRole.toUpperCase()}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{node.title}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions Panel */}
        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-200">សកម្មភាពរហ័ស (Quick Actions)</h3>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => onNavigate('agents')}
              className="w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-left transition-all flex items-center justify-between group"
            >
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                  ➕ បន្ថែម Agent ថ្មី
                </p>
                <p className="text-[10px] text-slate-500">Add Agent ដូចបន្ថែមមិត្តភក្តិ មិនបាច់សរសេរកូដ</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
            </button>

            <button
              onClick={() => onNavigate('memory')}
              className="w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-left transition-all flex items-center justify-between group"
            >
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                  🧠 គ្រប់គ្រង Shared Memory
                </p>
                <p className="text-[10px] text-slate-500">ពិនិត្យច្បាប់ និងទម្លាប់ដែល Agents បានចងចាំ</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
            </button>

            <button
              onClick={() => onNavigate('git')}
              className="w-full p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-left transition-all flex items-center justify-between group"
            >
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">
                  🌿 ពិនិត្យ Git Worktrees
                </p>
                <p className="text-[10px] text-slate-500">មើល Workspace ដាច់ដោយឡែករបស់ Agent នីមួយៗ</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
