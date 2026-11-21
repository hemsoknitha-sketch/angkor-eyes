import { useState } from "react";
import type { Agent } from "../lib/types";
import { api } from "../lib/api";
import ConfirmationDialog from "./ConfirmationDialogs";

export default function Roster({ agents, onChange }: { agents: Agent[]; onChange: () => void }) {
  const [confirm, setConfirm] = useState<Agent | null>(null);
  const [editing, setEditing] = useState<Agent | null>(null);

  const act = async (a: Agent, patch: Partial<Agent>) => { await api.updateAgent(a.id, patch); onChange(); };
  const clone = async (a: Agent) => { await api.createAgent({ name: `${a.name} (copy)`, project: a.project, role: a.role, model: a.model }); onChange(); };

  return (
    <div className="space-y-2">
      {agents.map((a) => (
        <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className="flex-1">
            <div className="font-semibold">{a.name} <span className="text-xs text-zinc-500">· {a.role} · {a.model}</span></div>
            <div className="text-xs text-zinc-500">{a.project} — {a.status === "active" ? "🟢 សកម្ម" : a.status === "paused" ? "⏸️ ផ្អាក" : "⏳ រវល់"}</div>
            {editing?.id === a.id && (
              <input className="mt-2 w-full border rounded px-2 py-1 bg-transparent" defaultValue={a.name}
                onBlur={(e) => { void act(a, { name: e.target.value }); setEditing(null); }} autoFocus />
            )}
          </div>
          <button className="text-sm px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800" onClick={() => setEditing(a)}>✏️ កែ</button>
          <button className="text-sm px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800" onClick={() => void clone(a)}>📋 Clone</button>
          <button className="text-sm px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800" onClick={() => void act(a, { status: a.status === "paused" ? "active" : "paused" })}>
            {a.status === "paused" ? "▶️ បន្ត" : "⏸️ ផ្អាក"}
          </button>
          <button className="text-sm px-2 py-1 rounded bg-red-100 dark:bg-red-900/40 text-red-700" onClick={() => setConfirm(a)}>🗑️ លុប</button>
        </div>
      ))}
      {agents.length === 0 && <p className="text-sm text-zinc-500">មិនទាន់មានភ្នាក់ងារទេ — បង្កើតភ្នាក់ងារដំបូង។</p>}
      {confirm && (
        <ConfirmationDialog title="លុបភ្នាក់ងារ? · Delete Agent?" body={`លុប ${confirm.name} ជាអចិន្ត្រៃយ៍?`} onCancel={() => setConfirm(null)}
          onConfirm={async () => { await api.deleteAgent(confirm.id); setConfirm(null); onChange(); }} />
      )}
    </div>
  );
}
