import { useState } from "react";

export default function AwayToggle({ initial = false }: { initial?: boolean }) {
  const [away, setAway] = useState(initial);
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <div className="flex-1">
        <div className="font-semibold">🚶 Away Mode · របៀបចាកចេញ</div>
        <p className="text-xs text-zinc-500">{away ? "ភ្នាក់ងារបន្តធ្វើការ ការអនុម័តរង់ចាំអ្នក។" : "អ្នកកំពុងនៅ — ការជូនដំណឹងមកភ្លាមៗ។"}</p>
      </div>
      <button role="switch" aria-checked={away} onClick={() => setAway(!away)}
        className={`w-12 h-7 rounded-full p-1 transition ${away ? "bg-violet-600" : "bg-zinc-300 dark:bg-zinc-700"}`}>
        <span className={`block w-5 h-5 bg-white rounded-full transition ${away ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
