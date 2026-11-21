import React, { useEffect, useState } from 'react';
import { History, RefreshCw, AlertCircle, CheckCircle2, Shield, Search } from 'lucide-react';
import { api, Task } from '../lib/api';

export const AuditCenter: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      const [l, t] = await Promise.all([api.getAuditLogs(), api.getTasks()]);
      setLogs(l);
      setTasks(t);
    } catch (err) {
      console.error('Failed to load audit data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRetryTask = async (taskId: string) => {
    await api.retryTask(taskId);
    loadData();
  };

  const filteredLogs = logs.filter(l =>
    l.eventType.toLowerCase().includes(search.toLowerCase()) ||
    JSON.stringify(l.details).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-400" />
          <span>សវនកម្ម & ការស្ដារឡើងវិញ (Audit Trail & Crash Recovery)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Immutable Action Logs, Checkpoint Resumption និង Dead Letter Queue Recovery
        </p>
      </div>

      {/* Task Checkpoint & Recovery Section */}
      <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
        <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
          <RefreshCw className="w-4 h-4 text-emerald-400" /> Task Checkpoints & Manual Crash Recovery:
        </span>

        <div className="space-y-2">
          {tasks.slice(-3).map(task => (
            <div key={task.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-200 font-bold">{task.title}</span>
                <span className="text-slate-500 ml-2">Step {task.currentStep}/{task.dag.length}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[10px] ${
                  task.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : task.status === 'failed'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-amber-500/10 text-amber-300'
                }`}>
                  {task.status.toUpperCase()}
                </span>
                {task.status === 'failed' && (
                  <button
                    onClick={() => handleRetryTask(task.id)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry Task
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search Audit Logs */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ស្វែងរកក្នុង Immutable Audit Trail..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={loadData}
          className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Audit Logs Table */}
      <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2 px-3">Timestamp</th>
              <th className="py-2 px-3">Event Type</th>
              <th className="py-2 px-3">Agent/User</th>
              <th className="py-2 px-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-[11px]">
            {filteredLogs.map(log => (
              <tr key={log.id} className="hover:bg-slate-900/40">
                <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </td>
                <td className="py-2.5 px-3 font-bold text-emerald-400">{log.eventType}</td>
                <td className="py-2.5 px-3 text-slate-300">{log.agentId || log.userId || 'system'}</td>
                <td className="py-2.5 px-3 text-slate-400 max-w-md truncate">
                  {JSON.stringify(log.details)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
