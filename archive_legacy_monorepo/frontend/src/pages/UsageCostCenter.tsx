import { useEffect, useState } from "react";
import type { UsageRow } from "../lib/types";
import { api } from "../lib/api";

/** Usage & Cost Center: token/cost per agent/day/project, budget limit, simple charts. */
export default function UsageCostCenter() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [budget, setBudget] = useState(50);
  useEffect(() => { api.listUsage().then(setRows); }, []);
  const total = rows.reduce((s, r) => s + r.costUsd, 0);
  const maxTokens = Math.max(1, ...rows.map((r) => r.tokens));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">💰 ការប្រើប្រាស់ & តម្លៃ · Usage & Cost Center</h1>
      <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border flex gap-6 flex-wrap">
        <div>សរុប · Total: <b>${total.toFixed(2)}</b></div>
        <label>ដែនកំណត់ថវិកា · Budget limit ($/ខែ): <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-20 border rounded px-2 py-1 bg-transparent" /></label>
        <div className={total > budget ? "text-red-600 font-semibold" : "text-green-600"}>{total > budget ? "⚠️ លើសថវិកា · Over budget" : "✅ ក្នុងថវិកា · Within budget"}</div>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="p-3 rounded-xl bg-white dark:bg-zinc-900 border text-sm">
            <div className="flex justify-between"><span>{r.agent} · {r.project} · {r.day}</span><span>{r.tokens.toLocaleString()} tokens · ${r.costUsd.toFixed(2)}</span></div>
            <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded mt-2"><div className="h-2 bg-violet-600 rounded" style={{ width: `${(r.tokens / maxTokens) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
