import { useState } from "react";
import { api } from "../lib/api";

/** Image/screenshot upload via backend presigned URL (S3/R2). */
export default function FileUpload({ roomId }: { roomId: string }) {
  const [status, setStatus] = useState("");
  const onFile = async (f: File) => {
    setStatus("កំពុងទាញ URL…");
    const { url, key } = await api.presignedUpload(f.name, f.type);
    if (!url) { setStatus("⚠️ Backend មិនទាន់មាន presign — ឯកសារមិនទាន់បានផ្ទុកឡើង (mock mode)"); return; }
    const res = await fetch(url, { method: "PUT", headers: { "content-type": f.type }, body: f });
    setStatus(res.ok ? `✅ បានផ្ទុកឡើង: ${key} (room ${roomId})` : "⚠️ Upload បរាជ័យ");
  };
  return (
    <label className="cursor-pointer text-lg px-1" title="Upload image/screenshot">
      📎<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
      {status && <span className="text-[11px] text-zinc-500 block">{status}</span>}
    </label>
  );
}
