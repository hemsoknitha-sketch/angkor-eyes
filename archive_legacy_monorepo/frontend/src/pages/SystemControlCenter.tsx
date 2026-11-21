import { useEffect, useState } from "react";
import { api } from "../lib/api";
import ConfirmationDialog from "../components/ConfirmationDialogs";

/** System Control Center: Runner status, Active Agents, Pending Tasks/Approvals, STOP ALL Kill Switch. */
export default function SystemControlCenter() {
  const [status, setStatus] = useState<{ running: boolean; activeAgents: number; pendingTasks: number; pendingApprovals: number } | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopped, setStopped] = useState(false);
  useEffect(() => { api.runnerStatus().then(setStatus); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">🎛️ មជ្ឈមណ្ឌលគ្រប់គ្រងប្រព័ន្ធ · System Control Center</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Runner", status ? (status.running ? "🟢 កំពុងដំណើរការ" : "🔴 ឈប់") : "…"],
          ["ភ្នាក់ងារសកម្ម · Active Agents", String(status?.activeAgents ?? "…")],
          ["កិច្ចការរង់ចាំ · Pending Tasks", String(status?.pendingTasks ?? "…")],
          ["ការអនុម័តរង់ចាំ · Pending Approvals", String(status?.pendingApprovals ?? "…")],
        ].map(([k, v]) => (
          <div key={k} className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"><div className="text-xs text-zinc-500">{k}</div><div className="font-bold text-lg">{v}</div></div>
        ))}
      </div>
      <div className="p-4 rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30">
        <h2 className="font-semibold text-red-700 dark:text-red-300">🛑 STOP ALL — Kill Switch</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">បញ្ឈប់ភ្នាក់ងារទាំងអស់ភ្លាមៗ។ ប្រើតែពេលមានអាសន្ន។</p>
        <button className="px-5 py-2 rounded-lg bg-red-600 text-white font-semibold" onClick={() => setConfirmStop(true)}>STOP ALL</button>
        {stopped && <p className="text-sm text-red-600 mt-2">⛔ ភ្នាក់ងារទាំងអស់ត្រូវបានបញ្ឈប់។</p>}
      </div>
      {confirmStop && <ConfirmationDialog title="បញ្ឈប់ទាំងអស់? · STOP ALL agents?" body="ភ្នាក់ងារទាំងអស់នឹងឈប់ដំណើរការភ្លាមៗ។" onCancel={() => setConfirmStop(false)} onConfirm={async () => { await api.stopAll(); setStopped(true); setConfirmStop(false); }} />}
    </div>
  );
}
