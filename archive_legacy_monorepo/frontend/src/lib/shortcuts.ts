import { useEffect } from "react";

/** Cmd+K opens the command palette; Cmd+Enter sends the current message. */
export function useShortcuts(opts: { onPalette: () => void; onSend: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); opts.onPalette(); }
      if (mod && e.key === "Enter") { e.preventDefault(); opts.onSend(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
