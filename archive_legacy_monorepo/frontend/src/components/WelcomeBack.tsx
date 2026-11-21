import { useEffect, useState } from "react";
import { api } from "../lib/api";

/** Timeline of work done while away + pending approvals. */
export default function WelcomeBack() {
  const [digest, setDigest] = useState<{ timeline: { at: string; text: string }[]; pendingApprovals: number; completed: number } | null>(null);
  useEffect(() => { api.awayDigest().then(setDigest); }, []);
  if (!digest) return <p className="text-sm text-zinc-500">កំពុងទាញសង្ខេប…</p>;
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <h3 className="font-semibold mb-2">👋 Welcome Back · ស្វាគមន៍ត្រឡប់មកវិញ</h3>
      <p className="text-sm">✅ បានបញ្ចប់ {digest.completed} កិច្ចការ · 🔔 រង់ចាំអនុម័ត {digest.pendingApprovals}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {digest.timeline.map((t, i) => <li key={i}>• {t.at} — {t.text}</li>)}
      </ul>
    </div>
  );
}
