import { useState } from "react";
import type { Approval } from "../lib/types";
import { api } from "../lib/api";
import DiffViewer from "./DiffViewer";

export default function WorktreePanel({ approvals, onChange }: { approvals: Approval[]; onChange: () => void }) {
  const [selected, setSelected] = useState<Approval | null>(approvals[0] ?? null);
  const decide = async (a: Approval, d: "approve" | "reject" | "not_yet") => { await api.decideApproval(a.id, d); onChange(); };
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-2">
        {approvals.map((a) => (
          <button key={a.id} onClick={() => setSelected(a)} className={`w-full text-left p-3 rounded-xl border ${selected?.id === a.id ? "border-violet-500" : "border-zinc-200 dark:border-zinc-800"} bg-white dark:bg-zinc-900`}>
            <div className="font-semibold text-sm">{a.title}</div>
            <div className="text-xs text-zinc-500">{a.summary} · {a.status === "pending" ? "⏳ រង់ចាំអនុម័ត" : a.status}</div>
          </button>
        ))}
        {approvals.length === 0 && <p className="text-sm text-zinc-500">មិនមានការអនុម័តរង់ចាំទេ។</p>}
      </div>
      {selected && (
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <h3 className="font-semibold mb-1">{selected.title}</h3>
          <p className="text-xs text-zinc-500 mb-3">Branch: feat/{selected.roomId} · Worktree: សកម្ម · Status: {selected.status}</p>
          <DiffViewer diff={selected.diff} />
          <div className="flex gap-2 mt-3">
            <button className="flex-1 py-2 rounded-lg bg-green-600 text-white" onClick={() => void decide(selected, "approve")}>✅ អនុម័ត · Approve</button>
            <button className="flex-1 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800" onClick={() => void decide(selected, "not_yet")}>⏳ មិនទាន់ · Not yet</button>
            <button className="flex-1 py-2 rounded-lg bg-red-600 text-white" onClick={() => void decide(selected, "reject")}>❌ បដិសេធ · Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}
