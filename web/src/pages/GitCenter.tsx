import React, { useEffect, useState } from 'react';
import {
  GitBranch, CheckCircle2, XCircle, AlertTriangle,
  GitCommit, Clock, ShieldCheck, Eye, Layers, Lock
} from 'lucide-react';
import { api, ApprovalRequest } from '../lib/api';

export const GitCenter: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [worktrees, setWorktrees] = useState<any[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);

  const loadData = async () => {
    try {
      const [apr, wt] = await Promise.all([
        api.getApprovals(),
        api.getWorktrees()
      ]);
      setApprovals(apr);
      setWorktrees(wt);
      if (apr.length > 0 && !selectedApproval) {
        setSelectedApproval(apr[0]);
      }
    } catch (err) {
      console.error('Failed to load git center data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = api.subscribeWs((event) => {
      if (event.type === 'APPROVAL_REQUIRED' || event.type === 'APPROVAL_UPDATED') {
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
    await api.rejectRequest(id, 'Rejected in Git Center');
    loadData();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-emerald-400" />
          <span>Git Worktrees & ច្រកអនុញ្ញាត (Approval Gate)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Worktree Isolation មិនជាន់កូដគ្នា + TOCTOU Cryptographic Verification មុន Push/Merge
        </p>
      </div>

      {/* Active Worktrees Table */}
      <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-emerald-400" /> Active Git Worktrees (Isolated Directories):
        </span>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2 px-3">Branch Name</th>
                <th className="py-2 px-3">Agent</th>
                <th className="py-2 px-3">Worktree Path</th>
                <th className="py-2 px-3">Base SHA</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {worktrees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    មិនទាន់មាន Worktree ទេ (នឹងបង្កើតស្វ័យប្រវត្តិតាម Task នីមួយៗ)
                  </td>
                </tr>
              ) : (
                worktrees.map((wt) => (
                  <tr key={wt.id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-3 text-emerald-300 font-bold">{wt.branchName}</td>
                    <td className="py-2.5 px-3 text-slate-300">{wt.agentId}</td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs">{wt.worktreePath}</td>
                    <td className="py-2.5 px-3 text-slate-500">{wt.baseCommitSha?.substring(0, 7) || 'HEAD'}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                        {wt.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Requests & Diff Viewer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Approvals List */}
        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-amber-400" /> សំណើរង់ចាំការសម្រេចចិត្ត:
          </span>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {approvals.map((req) => {
              const isSelected = selectedApproval?.id === req.id;
              const isPending = req.status === 'pending';
              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedApproval(req)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-2 ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500/50 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10">
                      {req.actionType}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        req.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : req.status === 'rejected'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-300 animate-pulse'
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-slate-200 font-medium line-clamp-2">{req.summary}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Branch: {req.branchName}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diff & TOCTOU Security Inspector */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
          {selectedApproval ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{selectedApproval.summary}</span>
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono mt-1 space-x-2">
                    <span>Target: <strong>{selectedApproval.targetRepo}</strong></span>
                    <span>•</span>
                    <span>Branch: <strong>{selectedApproval.branchName}</strong></span>
                    <span>•</span>
                    <span>Commit SHA: <strong>{selectedApproval.targetCommitSha}</strong></span>
                  </div>
                </div>

                {selectedApproval.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(selectedApproval.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 font-medium"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(selectedApproval.id)}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-xs font-semibold text-white shadow-emerald-500/20 shadow-md flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Merge</span>
                    </button>
                  </div>
                )}
              </div>

              {/* TOCTOU Security Hash Verification Card */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-400">TOCTOU Hash: </span>
                  <span className="text-emerald-400">{selectedApproval.actionHash}</span>
                </div>
                <span className="text-slate-500 text-[10px]">Expires in 2 hrs</span>
              </div>

              {/* Unified Diff View */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">Code Diff Preview:</span>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto max-h-80">
                  {selectedApproval.diffPayload ? (
                    selectedApproval.diffPayload.split('\n').map((line, idx) => {
                      const isAdd = line.startsWith('+');
                      const isDel = line.startsWith('-');
                      const isHeader = line.startsWith('@@') || line.startsWith('diff');
                      return (
                        <div
                          key={idx}
                          className={`py-0.5 px-2 rounded ${
                            isAdd
                              ? 'bg-emerald-950/40 text-emerald-300'
                              : isDel
                              ? 'bg-red-950/40 text-red-300'
                              : isHeader
                              ? 'text-cyan-400 font-semibold'
                              : 'text-slate-400'
                          }`}
                        >
                          {line}
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-slate-500">No diff payload attached.</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              សូមជ្រើសរើស Approval Request ណាមួយដើម្បីពិនិត្យ Diff
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
