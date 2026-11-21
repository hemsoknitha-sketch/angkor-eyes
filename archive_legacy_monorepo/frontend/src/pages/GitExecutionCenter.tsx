import { useEffect, useState } from "react";
import type { Approval } from "../lib/types";
import { api } from "../lib/api";
import WorktreePanel from "../components/WorktreePanel";

/** Git Execution Center: Branch / Commit / Worktree / Diff / Test Status / Logs. */
export default function GitExecutionCenter() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  useEffect(() => { api.listApprovals().then(setApprovals); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">🌿 មជ្ឈមណ្ឌល Git & Execution · Git Execution Center</h1>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border">🌿 Branch: <b>feat/checkout</b><br />Commit: <code>a1b2c3d</code></div>
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border">🧪 Test Status: <b className="text-green-600">✅ 12 passed / 0 failed</b></div>
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border">📜 Logs<br /><code className="text-xs">09:14 Dev: commit feat/checkout<br />09:10 QA: tests passed</code></div>
      </div>
      <h2 className="font-semibold">Worktrees & Diffs — ត្រូវការអនុម័ត</h2>
      <WorktreePanel approvals={approvals} onChange={() => api.listApprovals().then(setApprovals)} />
    </div>
  );
}
