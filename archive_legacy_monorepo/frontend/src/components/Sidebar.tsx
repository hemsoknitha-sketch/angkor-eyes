import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "🏠 ផ្ទាំងគ្រប់គ្រង · Home", end: true },
  { to: "/rooms", label: "💬 បន្ទប់ · Rooms" },
  { to: "/agents", label: "🤖 ភ្នាក់ងារ · Agents" },
  { to: "/control", label: "🎛️ មជ្ឈមណ្ឌលគ្រប់គ្រង · Control" },
  { to: "/git", label: "🌿 Git & Execution" },
  { to: "/security", label: "🛡️ សុវត្ថិភាព · Security" },
  { to: "/usage", label: "💰 ការប្រើប្រាស់ · Usage & Cost" },
  { to: "/audit", label: "📜 Audit & Recovery" },
];

export default function Sidebar() {
  return (
    <nav className="w-60 shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-3 hidden md:block">
      <div className="font-bold text-lg mb-1">👁️ ANGKOR EYES</div>
      <div className="text-xs text-zinc-500 mb-4">Lead Agent · Multi-Agent Platform</div>
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to} end={l.end} className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm ${isActive ? "bg-violet-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
