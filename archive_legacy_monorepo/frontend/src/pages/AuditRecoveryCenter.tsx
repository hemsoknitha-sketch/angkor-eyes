import { useEffect, useState } from "react";
import type { AuditEntry } from "../lib/types";
import { api } from "../lib/api";
import SearchBar from "../components/SearchBar";

/** Audit & Recovery Center: search audit, diff, restore checkpoints, retry failed tasks. */
export default function AuditRecoveryCenter() {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { api.listAudit().then(setAudit); }, []);
  const search = (query: string) => { setQ(query); api.listAudit(query).then(setAudit); };
  const filtered = audit.filter((a) => !q || `${a.actor} ${a.action} ${a.detail}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">📜 Audit & Recovery · សវនកម្ម & ស្តារឡើងវិញ</h1>
      <SearchBar onSearch={search} />
      <ul className="space-y-1 text-sm">
        {filtered.map((a) => (
          <li key={a.id} className="p-3 rounded-lg bg-white dark:bg-zinc-900 border flex justify-between gap-3">
            <span>• {a.at} — {a.actor}: {a.action} — {a.detail}</span>
            <span className="flex gap-2 shrink-0">
              <button className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800" onClick={() => setMsg(`↩️ Checkpoint ${a.id} ត្រូវបានស្តារឡើងវិញ (mock) · Restored`)}>↩️ Restore checkpoint</button>
              <button className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800" onClick={() => setMsg(`🔁 កិច្ចការ ${a.id} ត្រូវបានព្យាយាមម្តងទៀត (mock) · Retried`)}>🔁 Retry</button>
            </span>
          </li>
        ))}
      </ul>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {filtered.length === 0 && <p className="text-sm text-zinc-500">មិនមានកំណត់ត្រាត្រូវនឹងការស្វែងរកទេ។</p>}
    </div>
  );
}
