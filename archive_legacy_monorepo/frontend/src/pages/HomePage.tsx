import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Approval, MemoryRule, TaskNode } from "../lib/types";
import { api } from "../lib/api";
import { mockTaskTree } from "../lib/mock";
import TaskTree from "../components/TaskTree";
import WorktreePanel from "../components/WorktreePanel";
import MemoryPanel from "../components/MemoryPanel";
import AwayToggle from "../components/AwayToggle";
import WelcomeBack from "../components/WelcomeBack";
import NotificationPreferences from "../components/NotificationPreferences";
import OnboardingWizard from "../components/OnboardingWizard";
import SearchBar from "../components/SearchBar";

export default function HomePage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [memory, setMemory] = useState<MemoryRule[]>([]);
  const [tasks] = useState<TaskNode[]>(mockTaskTree);
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem("ae-onboarded") === "1");
  const [q, setQ] = useState("");
  const load = () => { api.listApprovals().then(setApprovals); api.listMemory().then(setMemory); };
  useEffect(load, []);

  if (!onboarded) {
    return <OnboardingWizard onDone={() => { localStorage.setItem("ae-onboarded", "1"); setOnboarded(true); }} />;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h1 className="text-xl font-bold">👁️ ANGKOR EYES — Lead Agent</h1>
        <div className="w-full md:w-80"><SearchBar onSearch={setQ} /></div>
      </div>
      {q && <p className="text-sm text-zinc-500">ស្វែងរក “{q}” ក្នុង chat + memories…</p>}
      <div className="grid md:grid-cols-2 gap-4">
        <AwayToggle />
        <WelcomeBack />
      </div>
      <TaskTree nodes={tasks} />
      <div>
        <h2 className="font-semibold mb-2">🔔 ការអនុម័តរង់ចាំ · Pending Approvals</h2>
        <WorktreePanel approvals={approvals} onChange={load} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div><h2 className="font-semibold mb-2">🧠 Shared Memory · អង្គចងចាំរួម</h2><MemoryPanel rules={memory} onChange={load} /></div>
        <div className="space-y-4"><NotificationPreferences />
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border text-sm space-y-1">
            <div className="font-semibold">មជ្ឈមណ្ឌលទាំង 5 · The 5 Centers</div>
            <Link className="block text-violet-600" to="/control">🎛️ System Control Center</Link>
            <Link className="block text-violet-600" to="/git">🌿 Git Execution Center</Link>
            <Link className="block text-violet-600" to="/security">🛡️ Security Center</Link>
            <Link className="block text-violet-600" to="/usage">💰 Usage & Cost Center</Link>
            <Link className="block text-violet-600" to="/audit">📜 Audit & Recovery Center</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
