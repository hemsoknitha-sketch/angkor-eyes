import type { ReactNode } from "react";

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
      <div className="text-4xl mb-2">{icon}</div>
      <div className="font-semibold">{title}</div>
      <p className="text-sm text-zinc-500 mt-1">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
