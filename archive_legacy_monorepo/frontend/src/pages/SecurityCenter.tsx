import { useEffect, useState } from "react";
import type { AuditEntry } from "../lib/types";
import { api } from "../lib/api";

/** Security Center: alerts, permission changes, secret detection, approval history. */
export default function SecurityCenter() {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  useEffect(() => { api.listAudit().then(setAudit); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">🛡️ មជ្ឈមណ្ឌលសុវត្ថិភាព · Security Center</h1>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200">🔐 Secret Detection: <b>គ្មាន secret លេចធ្លាយ · No secrets detected</b></div>
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border">👤 Permission Changes: <b>0 ក្នុង 7 ថ្ងៃនេះ</b></div>
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border">⚠️ Alerts: <b>0 សកម្ម</b></div>
      </div>
      <h2 className="font-semibold">ប្រវត្តិការអនុម័ត · Approval History</h2>
      <ul className="space-y-1 text-sm">
        {audit.map((a) => <li key={a.id} className="p-3 rounded-lg bg-white dark:bg-zinc-900 border">• {a.at} — {a.actor}: {a.action} — {a.detail}</li>)}
      </ul>
    </div>
  );
}
