import { useState } from "react";

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState({ approvals: true, mentions: true, summaries: false, digest: true });
  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));
  const rows: { key: keyof typeof prefs; label: string }[] = [
    { key: "approvals", label: "🔔 ការអនុម័ត · Approvals" },
    { key: "mentions", label: "@ Mention ក្នុងបន្ទប់ · Room mentions" },
    { key: "summaries", label: "📋 សង្ខេបពេលបន្ទប់បញ្ចប់ · Room summaries" },
    { key: "digest", label: "📬 Welcome Back Digest" },
  ];
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
      <h3 className="font-semibold">🔔 ការជូនដំណឹង · Notification Preferences</h3>
      {rows.map((r) => (
        <label key={r.key} className="flex justify-between text-sm cursor-pointer">
          {r.label}
          <input type="checkbox" checked={prefs[r.key]} onChange={() => toggle(r.key)} className="accent-violet-600 w-4 h-4" />
        </label>
      ))}
    </div>
  );
}
