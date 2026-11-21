/** Simple diff view (no extra dep): + lines green, − lines red. */
export default function DiffViewer({ diff }: { diff: string }) {
  return (
    <pre className="text-xs overflow-x-auto p-3 rounded-lg bg-zinc-950 text-zinc-100 font-mono leading-relaxed">
      {diff.split("\n").map((line, i) => (
        <div key={i} className={line.startsWith("+") ? "bg-green-900/40 text-green-300" : line.startsWith("-") ? "bg-red-900/40 text-red-300" : ""}>{line || " "}</div>
      ))}
    </pre>
  );
}
