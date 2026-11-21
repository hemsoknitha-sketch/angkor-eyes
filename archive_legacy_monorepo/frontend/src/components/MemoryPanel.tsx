import { useState } from "react";
import type { MemoryRule } from "../lib/types";
import { api } from "../lib/api";

/** Shared Memory / Rules — view, edit, delete. */
export default function MemoryPanel({ rules, onChange }: { rules: MemoryRule[]; onChange: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<MemoryRule | null>(null);
  const save = async () => {
    if (!title.trim() || !body.trim()) return;
    await api.saveMemory({ title: title.trim(), body: body.trim(), scope: "shared" });
    setTitle(""); setBody(""); setEditing(null); onChange();
  };
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between"><span className="font-semibold text-sm">{r.title}</span><span className="text-xs text-zinc-500">{r.scope === "shared" ? "Shared Memory" : r.scope}</span></div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{r.body}</p>
            <div className="flex gap-2 mt-2">
              <button className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800" onClick={() => { setEditing(r); setTitle(r.title); setBody(r.body); }}>✏️ កែ · Edit</button>
              <button className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/40" onClick={() => void api.deleteMemory(r.id).then(onChange)}>🗑️ លុប · Delete</button>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
        <h4 className="font-semibold text-sm">{editing ? "កែច្បាប់ · Edit Rule" : "បន្ថែមច្បាប់ថ្មី · Add Rule"}</h4>
        <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="ចំណងជើង · Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full border rounded px-3 py-2 bg-transparent" placeholder="ខ្លឹមសារ · Content" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        <button className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm" onClick={() => void save()}>💾 រក្សាទុក · Save</button>
      </div>
    </div>
  );
}
