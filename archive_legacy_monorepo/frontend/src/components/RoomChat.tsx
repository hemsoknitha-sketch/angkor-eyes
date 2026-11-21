import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Room } from "../lib/types";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import FeedbackButtons from "./FeedbackButtons";
import FileUpload from "./FileUpload";
import StreamingMessage from "./StreamingMessage";
import { ChatSkeleton } from "./LoadingSkeletons";

const MENTIONS = ["@Lead", "@Dev", "@QA", "@Reviewer", "@Advisor"];

/** Per-project room chat: live typing, queue display, @mention autocomplete. */
export default function RoomChat({ room, onSend }: { room: Room; onSend: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState<string | null>(null);
  const [queue, setQueue] = useState<string>("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api.roomMessages(room.id).then((m) => { setMessages(m); setLoading(false); });
    const s = getSocket();
    s?.emit("room:join", room.id);
    const onTyping = (p: { roomId: string; agent: string }) => { if (p.roomId === room.id) { setTyping(p.agent); setTimeout(() => setTyping(null), 4000); } };
    const onQueue = (p: { roomId: string; queue: string }) => { if (p.roomId === room.id) setQueue(p.queue); };
    const onNew = (p: { roomId: string; text: string; author: string }) => {
      if (p.roomId !== room.id) return;
      setStreaming(p.text);
      setMessages((prev) => [...prev, { id: `m-${Date.now()}`, roomId: room.id, author: p.author, role: "dev", text: p.text, at: new Date().toLocaleTimeString() }]);
      setStreaming(null);
    };
    s?.on("typing", onTyping); s?.on("queue:update", onQueue); s?.on("message:new", onNew);
    return () => { s?.off("typing", onTyping); s?.off("queue:update", onQueue); s?.off("message:new", onNew); s?.emit("room:leave", room.id); };
  }, [room.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const send = async () => {
    if (!text.trim()) return;
    const t = text; setText(""); setShowMentions(false);
    const sent = await api.sendMessage(room.id, t);
    setMessages((prev) => [...prev, sent]);
    onSend();
  };

  const onChange = (v: string) => {
    setText(v);
    setShowMentions(v.endsWith("@") || /@\w*$/.test(v) && v.includes("@"));
  };

  return (
    <div className="flex flex-col h-full rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="font-semibold">📁 {room.name} <span className="text-xs text-zinc-500">· {room.project}{room.topicId ? ` · Topic #${room.topicId}` : ""}</span></div>
        {queue && <div className="text-xs text-amber-600">⏳ ជួរ · Queue: {queue}</div>}
        {!queue && <div className="text-xs text-zinc-500">Advisor waits for QA, then answers — ជួរនឹងបង្ហាញនៅទីនេះពេលមានកិច្ចការ</div>}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? <ChatSkeleton /> : messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] ${m.role === "user" ? "ml-auto text-right" : ""}`}>
            <div className={`inline-block px-3 py-2 rounded-2xl text-sm ${m.role === "user" ? "bg-violet-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>
              <div className="text-xs opacity-70">{m.author} · {m.at}</div>{m.text}
            </div>
            {m.role !== "user" && <FeedbackButtons messageId={m.id} />}
          </div>
        ))}
        {streaming && <StreamingMessage text={streaming} />}
        {typing && <div className="text-xs text-zinc-500 italic">{typing} កំពុងវាយ… · typing…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        {showMentions && (
          <div className="flex gap-1 mb-2 flex-wrap">
            {MENTIONS.map((m) => <button key={m} className="text-xs px-2 py-1 rounded bg-violet-100 dark:bg-violet-900/40" onClick={() => { setText((t) => t.replace(/@\w*$/, m + " ")); setShowMentions(false); }}>{m}</button>)}
          </div>
        )}
        <div className="flex gap-2 items-center">
          <FileUpload roomId={room.id} />
          <input value={text} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); else if (e.key === "Enter") void send(); }}
            placeholder="សរសេរសារ… (Cmd+Enter ដើម្បីផ្ញើ) · @ ដើម្បី mention" className="flex-1 border rounded-lg px-3 py-2 bg-transparent border-zinc-300 dark:border-zinc-700" />
          <button onClick={() => void send()} className="px-4 py-2 rounded-lg bg-violet-600 text-white">ផ្ញើ · Send</button>
        </div>
        <div className="text-[11px] text-zinc-400 mt-1">↩️ Regenerate: ចុចលើសារចាស់ដើម្បីស្នើសុំចម្លើយថ្មី · “Retry from here” មានក្នុងប្រវត្តិសារ</div>
      </div>
    </div>
  );
}
