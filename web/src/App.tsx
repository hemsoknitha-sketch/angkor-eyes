import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { ChatRoom } from './pages/ChatRoom';
import { Agents } from './pages/Agents';
import { GitCenter } from './pages/GitCenter';
import { Memory } from './pages/Memory';
import { Security } from './pages/Security';
import { CostCenter } from './pages/CostCenter';
import { AuditCenter } from './pages/AuditCenter';
import { api, SystemStatus } from './lib/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [awayMode, setAwayMode] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const s = await api.getStatus();
      setStatus(s);
      setAwayMode(s.awayModeEnabled);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  useEffect(() => {
    // Initialize Telegram WebApp SDK
    api.initTelegram();
    loadStatus();

    // Subscribe to real-time events
    const unsubscribe = api.subscribeWs((event) => {
      if (event.type === 'APPROVAL_REQUIRED') {
        setToastMessage(`⚠️ សំណើថ្មីត្រូវការអនុម័ត: ${event.approval.summary}`);
        loadStatus();
      }
      if (event.type === 'AWAY_MODE_CHANGED') {
        setAwayMode(event.enabled);
        loadStatus();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleToggleAway = async () => {
    try {
      const res = await api.toggleAwayMode();
      setAwayMode(res.awayModeEnabled);
      loadStatus();
    } catch (err) {
      console.error('Failed to toggle away mode:', err);
    }
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={(tab) => setActiveTab(tab)} />;
      case 'chat':
        return <ChatRoom />;
      case 'agents':
        return <Agents />;
      case 'git':
        return <GitCenter />;
      case 'memory':
        return <Memory />;
      case 'security':
        return <Security />;
      case 'costs':
        return <CostCenter />;
      case 'audit':
        return <AuditCenter />;
      default:
        return <Dashboard onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 flex flex-col font-sans">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-18 right-4 z-50 bg-amber-500/90 text-slate-950 font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs animate-bounce">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 bg-black/20 hover:bg-black/30 rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navbar */}
      <Navbar
        status={status}
        awayMode={awayMode}
        onToggleAway={handleToggleAway}
        activeTab={activeTab}
      />

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingApprovalsCount={status?.pendingApprovalsCount}
        />
        <main className="flex-1 overflow-y-auto bg-[#0a0f1d]">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
};

export default App;
