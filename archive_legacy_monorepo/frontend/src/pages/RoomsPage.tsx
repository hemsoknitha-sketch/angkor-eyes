import { useEffect, useState } from "react";
import type { Room } from "../lib/types";
import { api } from "../lib/api";
import RoomChat from "../components/RoomChat";
import ConfirmationDialog from "../components/ConfirmationDialogs";
import { EmptyState } from "../components/EmptyStates";
import { ListSkeleton } from "../components/LoadingSkeletons";

/** Room management: Create / Rename / Archive / Delete via context menu. */
export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Room | null>(null);
  const [newName, setNewName] = useState("");
  const [menu, setMenu] = useState<Room | null>(null);
  const [confirm, setConfirm] = useState<{ room: Room; action: "archive" | "delete" } | null>(null);
  const [rename, setRename] = useState<Room | null>(null);

  const load = () => api.listRooms().then((r) => { setRooms(r); setLoading(false); if (!active && r[0]) setActive(r[0]); });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!newName.trim()) return;
    await api.createRoom(newName.trim(), newName.trim());
    setNewName(""); load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">💬 បន្ទប់ · Rooms</h1>
      <div className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ឈ្មោះបន្ទប់ថ្មី · New room name (e.g. my-shop)" className="flex-1 border rounded-lg px-3 py-2 bg-transparent" />
        <button onClick={() => void create()} className="px-4 py-2 rounded-lg bg-violet-600 text-white">➕ បង្កើត</button>
      </div>
      {loading ? <ListSkeleton /> : rooms.length === 0 ? (
        <EmptyState icon="💬" title="មិនទាន់មានបន្ទប់ទេ" body="បង្កើតបន្ទប់ដំបូងសម្រាប់គម្រោងរបស់អ្នក — ឧ. my-shop, launch-day" />
      ) : (
        <div className="grid md:grid-cols-[220px_1fr] gap-4 items-start">
          <div className="space-y-1">
            {rooms.map((r) => (
              <div key={r.id} className={`flex items-center rounded-lg ${active?.id === r.id ? "bg-violet-100 dark:bg-violet-900/40" : ""}`}>
                <button className="flex-1 text-left px-3 py-2 text-sm" onClick={() => setActive(r)}>📁 {r.name}</button>
                <button aria-label="room menu" className="px-2" onClick={() => setMenu(menu?.id === r.id ? null : r)}>⋮</button>
                {menu?.id === r.id && (
                  <div className="absolute z-10 mt-24 ml-32 bg-white dark:bg-zinc-900 border rounded-lg shadow p-1 text-sm">
                    <button className="block px-3 py-1 w-full text-left" onClick={() => { setRename(r); setMenu(null); }}>✏️ Rename</button>
                    <button className="block px-3 py-1 w-full text-left" onClick={() => { setConfirm({ room: r, action: "archive" }); setMenu(null); }}>📦 Archive</button>
                    <button className="block px-3 py-1 w-full text-left text-red-600" onClick={() => { setConfirm({ room: r, action: "delete" }); setMenu(null); }}>🗑️ Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="h-[560px]">{active ? <RoomChat room={active} onSend={() => undefined} /> : <EmptyState icon="💬" title="ជ្រើសបន្ទប់មួយ" body="Select a room to start chatting" />}</div>
        </div>
      )}
      {rename && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 w-full max-w-sm">
            <h3 className="font-semibold mb-2">✏️ Rename · ប្តូរឈ្មោះបន្ទប់</h3>
            <input defaultValue={rename.name} autoFocus className="w-full border rounded px-3 py-2 bg-transparent"
              onKeyDown={(e) => { if (e.key === "Enter") { void api.createRoom((e.target as HTMLInputElement).value, rename.project).then(() => { setRename(null); load(); }); } }} />
            <div className="flex justify-end gap-2 mt-3"><button className="px-3 py-2 rounded bg-zinc-100 dark:bg-zinc-800" onClick={() => setRename(null)}>បោះបង់</button></div>
            <p className="text-xs text-zinc-500 mt-2">Rename ត្រូវបានរក្សាទុកតាមរយៈ backend (POST /api/rooms) — ក្នុង mock mode វាបង្កើតបន្ទប់ថ្មី។</p>
          </div>
        </div>
      )}
      {confirm && <ConfirmationDialog title={confirm.action === "delete" ? "លុបបន្ទប់? · Delete Room?" : "Archive បន្ទប់? · Archive Room?"}
        body={`${confirm.action === "delete" ? "លុប" : "Archive"} បន្ទប់ ${confirm.room.name}?`}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { if (confirm.action === "delete") await api.deleteRoom(confirm.room.id); else await api.archiveRoom(confirm.room.id); setConfirm(null); load(); }} />}
    </div>
  );
}
