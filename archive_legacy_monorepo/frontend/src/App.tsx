import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import Sidebar from "./components/Sidebar";
import CommandPalette from "./components/CommandPalette";
import { useShortcuts } from "./lib/shortcuts";
import HomePage from "./pages/HomePage";
import RoomsPage from "./pages/RoomsPage";
import AgentsPage from "./pages/AgentsPage";
import SystemControlCenter from "./pages/SystemControlCenter";
import GitExecutionCenter from "./pages/GitExecutionCenter";
import SecurityCenter from "./pages/SecurityCenter";
import UsageCostCenter from "./pages/UsageCostCenter";
import AuditRecoveryCenter from "./pages/AuditRecoveryCenter";

export default function App() {
  const [palette, setPalette] = useState(false);
  const [dark, setDark] = useState(() => WebApp.colorScheme === "dark" || window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Cmd+K palette; Cmd+Enter is handled by RoomChat's input (send).
  useShortcuts({ onPalette: () => setPalette(true), onSend: () => undefined });

  return (
    <BrowserRouter>
      <div className="min-h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex">
        <Sidebar />
        <main className="flex-1 p-4 max-w-5xl mx-auto w-full">
          <div className="flex justify-end gap-2 mb-3">
            <button onClick={() => setPalette(true)} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700">⌘K · ពាក្យបញ្ជា</button>
            <button onClick={() => setDark(!dark)} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700">{dark ? "☀️ Light" : "🌙 Dark"}</button>
          </div>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/control" element={<SystemControlCenter />} />
            <Route path="/git" element={<GitExecutionCenter />} />
            <Route path="/security" element={<SecurityCenter />} />
            <Route path="/usage" element={<UsageCostCenter />} />
            <Route path="/audit" element={<AuditRecoveryCenter />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </BrowserRouter>
  );
}
