import type { TaskNode } from "../lib/types";

const icon: Record<TaskNode["status"], string> = { todo: "⬜", doing: "🔄", done: "✅", blocked: "⛔" };
const roleLabel: Record<string, string> = { lead: "Lead", dev: "Dev", qa: "QA", reviewer: "Reviewer", advisor: "Advisor" };

function Node({ node, depth }: { node: TaskNode; depth: number }) {
  return (
    <div style={{ marginLeft: depth * 16 }} className="py-1">
      <div className="flex gap-2 text-sm">
        <span>{icon[node.status]}</span><span className="flex-1">{node.title}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40">{roleLabel[node.assignee] ?? node.assignee}</span>
      </div>
      {node.children?.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
    </div>
  );
}

/** Lead plan broken down to Dev / QA / Reviewer. */
export default function TaskTree({ nodes }: { nodes: TaskNode[] }) {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <h3 className="font-semibold mb-2">🌳 ផែនការ Lead · Lead Plan</h3>
      {nodes.length === 0 ? <p className="text-sm text-zinc-500">មិនទាន់មានកិច្ចការទេ។</p> : nodes.map((n) => <Node key={n.id} node={n} depth={0} />)}
    </div>
  );
}
