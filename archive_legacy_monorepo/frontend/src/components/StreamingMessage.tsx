/** Streaming (SSE-style) display: text appears with a blinking cursor. */
export default function StreamingMessage({ text }: { text: string }) {
  return (
    <div className="max-w-[85%] px-3 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-sm">
      {text}<span className="animate-pulse">▍</span>
    </div>
  );
}
