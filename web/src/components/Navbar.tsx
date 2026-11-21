import React from 'react';
import { ShieldCheck, Moon, Sun, Cpu, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';
import { SystemStatus } from '../lib/api';

interface NavbarProps {
  status: SystemStatus | null;
  awayMode: boolean;
  onToggleAway: () => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({ status, awayMode, onToggleAway }) => {
  const isOnline = status?.runnerStatus === 'Online';

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0d1424] px-4 flex items-center justify-between sticky top-0 z-30 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-500 flex items-center justify-center shadow-emerald-500/20 shadow-md">
          <Eye className="w-6 h-6 text-slate-950 font-bold" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-wide bg-gradient-to-r from-emerald-400 via-teal-200 to-amber-300 bg-clip-text text-transparent">
              ANGKOR EYES
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase font-mono font-semibold">
              AGI v2.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 -mt-0.5">
            Autonomous Multi-Agent Orchestrator
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Runner Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
          <Cpu className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-slate-300">Runner:</span>
          <span className={`font-semibold ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
            {status?.runnerStatus || 'Checking...'}
          </span>
        </div>

        {/* Pending Approvals Badge */}
        {status && status.pendingApprovalsCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">{status.pendingApprovalsCount}</span>
            <span className="hidden md:inline">Approval needed</span>
          </div>
        )}

        {/* Away Mode Switch */}
        <button
          onClick={onToggleAway}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            awayMode
              ? 'bg-purple-900/40 text-purple-200 border border-purple-500/50 shadow-purple-500/20 shadow-sm'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
          }`}
          title={awayMode ? 'Away Mode is Active' : 'Enable Away Mode'}
        >
          {awayMode ? (
            <>
              <Moon className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span className="font-semibold">Away: Active</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Away Mode</span>
            </>
          )}
        </button>

        {/* Telegram Profile Avatar */}
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-emerald-400">
          KH
        </div>
      </div>
    </header>
  );
};
