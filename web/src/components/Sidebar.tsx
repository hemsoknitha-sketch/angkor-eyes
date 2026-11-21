import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  GitBranch,
  Brain,
  Shield,
  Coins,
  History
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingApprovalsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, pendingApprovalsCount }) => {
  const navItems = [
    { id: 'dashboard', labelKhmer: 'ផ្ទាំងបញ្ជាស្នូល', labelEn: 'Control Center', icon: LayoutDashboard },
    { id: 'chat', labelKhmer: 'បន្ទប់សន្ទនា AI', labelEn: 'Group & Lead Chat', icon: MessageSquare },
    { id: 'agents', labelKhmer: 'បញ្ជីរាយនាម Agents', labelEn: 'Agents Roster', icon: Users },
    { id: 'git', labelKhmer: 'Git & Worktrees', labelEn: 'Git & Approvals', icon: GitBranch, badge: pendingApprovalsCount },
    { id: 'memory', labelKhmer: 'ការចងចាំរួម', labelEn: 'Shared Memory', icon: Brain },
    { id: 'security', labelKhmer: 'សុវត្ថិភាព & សិទ្ធិ', labelEn: 'Security Center', icon: Shield },
    { id: 'costs', labelKhmer: 'ការចំណាយ & Tokens', labelEn: 'Usage & Costs', icon: Coins },
    { id: 'audit', labelKhmer: 'សវនកម្ម & ស្ដារឡើងវិញ', labelEn: 'Audit & Recovery', icon: History }
  ];

  return (
    <aside className="w-16 sm:w-64 border-r border-slate-800 bg-[#0a0f1d] flex flex-col justify-between shrink-0">
      <div className="py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all relative ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-400 border border-emerald-500/30 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div className="hidden sm:block truncate">
                <p className="text-xs font-semibold leading-tight">{item.labelKhmer}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{item.labelEn}</p>
              </div>

              {item.badge && item.badge > 0 ? (
                <span className="hidden sm:inline-flex ml-auto text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full font-bold">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-800/80 hidden sm:block text-[11px] text-slate-500 text-center">
        <span>ANGKOR EYES Engine</span>
        <div className="text-[9px] text-slate-600">Built with 🇰🇭 Pride</div>
      </div>
    </aside>
  );
};
