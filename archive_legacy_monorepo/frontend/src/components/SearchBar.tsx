import { useState } from "react";

export default function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <input value={q} onChange={(e) => { setQ(e.target.value); onSearch(e.target.value); }}
      placeholder="🔍 ស្វែងរកក្នុង chat + memories… · Search chat & memories"
      className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700" />
  );
}
