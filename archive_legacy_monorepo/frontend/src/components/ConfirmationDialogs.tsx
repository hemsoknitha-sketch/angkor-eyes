export default function ConfirmationDialog({ title, body, onCancel, onConfirm }: {
  title: string; body: string; onCancel: () => void; onConfirm: () => void | Promise<void>;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 max-w-sm w-full">
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">{body}</p>
        <div className="flex gap-2 justify-end">
          <button className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800" onClick={onCancel}>បោះបង់ · Cancel</button>
          <button className="px-3 py-2 rounded-lg bg-red-600 text-white" onClick={() => void onConfirm()}>បញ្ជាក់ · Confirm</button>
        </div>
      </div>
    </div>
  );
}
