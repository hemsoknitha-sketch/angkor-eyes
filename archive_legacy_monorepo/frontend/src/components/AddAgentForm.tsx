import { useState } from "react";
import { api } from "../lib/api";
import type { AgentRole } from "../lib/types";

/** No-code agent creation: name, project, role, model. */
export default function AddAgentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [project, setProject] = useState("my-shop");
  const [role, setRole] = useState<AgentRole>("dev");
  const [model, setModel] = useState("claude-sonnet-4");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await api.createAgent({ name: name.trim(), project, role, model });
    setBusy(false); setDone(true); setName(""); onCreated();
    setTimeout(() => setDone(false), 3000);
  };

  const input = "w-full border rounded-lg px-3 py-2 bg-transparent border-zinc-300 dark:border-zinc-700";
  return (
    <form className="space-y-3 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <h3 className="font-semibold">➕ ភ្នាក់ងារថ្មី · New Agent</h3>
      <label className="block text-sm">ឈ្មោះ · Name<input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="ឧ. Dev" required /></label>
      <label className="block text-sm">គម្រោង · Project<input className={input} value={project} onChange={(e) => setProject(e.target.value)} /></label>
      <label className="block text-sm">តួនាទី · Role
        <select className={input} value={role} onChange={(e) => setRole(e.target.value as AgentRole)}>
          <option value="lead">Lead Agent</option><option value="dev">Dev</option><option value="qa">QA</option><option value="reviewer">Reviewer</option><option value="advisor">Advisor</option>
        </select>
      </label>
      <label className="block text-sm">Model
        <select className={input} value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="claude-sonnet-4">Claude Sonnet 4</option><option value="gpt-5-mini">GPT-5 mini</option><option value="claude-haiku-4">Claude Haiku 4</option>
        </select>
      </label>
      <button disabled={busy} className="w-full py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50">{busy ? "កំពុងបង្កើត…" : "បង្កើតភ្នាក់ងារ · Create"}</button>
      {done && <p className="text-sm text-green-600">✅ បង្កើតរួចហើយ · Created</p>}
    </form>
  );
}
