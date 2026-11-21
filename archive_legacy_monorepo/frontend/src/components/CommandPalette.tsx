import { useNavigate } from "react-router-dom";

const COMMANDS = [
  { label: "➕ ភ្នាក់ងារថ្មី · New Agent", to: "/agents" },
  { label: "💬 បន្ទប់ · Rooms", to: "/rooms" },
  { label: "🎛️ System Control Center", to: "/control" },
  { label: "🌿 Git Execution Center", to: "/git" },
  { label: "🛡️ Security Center", to: "/security" },
  { label: "💰 Usage & Cost Center", to: "/usage" },
  { label: "📜 Audit & Recovery Center", to: "/audit" },
];

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-24 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md p-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs text-zinc-500 mb-2">⌘K · Command Palette — វាយដើម្បីស្វែងរក</div>
        {COMMANDS.map((c) => (
          <button key={c.to} className="block w-full text-left px-3 py-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
            onClick={() => { nav(c.to); onClose(); }}>{c.label}</button>
        ))}
      </div>
    </div>
  );
}
