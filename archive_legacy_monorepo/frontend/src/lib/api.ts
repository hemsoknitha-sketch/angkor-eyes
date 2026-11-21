import WebApp from "@twa-dev/sdk";
import type { Agent, Approval, AuditEntry, ChatMessage, MemoryRule, Room, UsageRow } from "./types";
import { mockAgents, mockApprovals, mockAudit, mockMemory, mockMessages, mockRooms, mockUsage } from "./mock";

export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "") ?? "";
export const BOT_USERNAME = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? "";

/** Telegram initData for backend auth (empty outside Telegram — backend then falls back to mock-friendly mode). */
function authHeaders(): Record<string, string> {
  const initData = WebApp.initData || "";
  return initData ? { "x-telegram-init-data": initData } : {};
}

async function get<T>(path: string, fallback: T): Promise<T> {
  if (!BACKEND_URL) return fallback;
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch { return fallback; } // graceful mock fallback when backend unreachable
}
async function post<T>(path: string, body: unknown, fallback: T): Promise<T> {
  if (!BACKEND_URL) return fallback;
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, { method: "POST", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch { return fallback; }
}

export const api = {
  backendUrl: BACKEND_URL,
  listAgents: () => get<Agent[]>("/api/agents", mockAgents),
  createAgent: (a: Omit<Agent, "id" | "status">) => post<Agent>("/api/agents", a, { ...a, id: `a-${Date.now()}`, status: "active" }),
  updateAgent: (id: string, patch: Partial<Agent>) => post<Agent>(`/api/agents/${id}`, patch, { ...mockAgents[0], ...patch, id }),
  deleteAgent: (id: string) => post<{ ok: boolean }>(`/api/agents/${id}/delete`, {}, { ok: true }),
  listRooms: () => get<Room[]>("/api/rooms", mockRooms),
  createRoom: (name: string, project: string) => post<Room>("/api/rooms", { name, project }, { id: name, name, project }),
  archiveRoom: (id: string) => post<{ ok: boolean }>(`/api/rooms/${id}/archive`, {}, { ok: true }),
  deleteRoom: (id: string) => post<{ ok: boolean }>(`/api/rooms/${id}/delete`, {}, { ok: true }),
  roomMessages: (roomId: string) => get<ChatMessage[]>(`/api/rooms/${roomId}/messages`, mockMessages.filter((m) => m.roomId === roomId)),
  sendMessage: (roomId: string, text: string) => post<ChatMessage>(`/api/rooms/${roomId}/messages`, { text }, { id: `m-${Date.now()}`, roomId, author: "Sinath", role: "user", text, at: new Date().toLocaleTimeString() }),
  listApprovals: () => get<Approval[]>("/api/approvals", mockApprovals),
  decideApproval: (id: string, decision: "approve" | "reject" | "not_yet") => post<{ ok: boolean }>(`/api/approvals/${id}/decide`, { decision }, { ok: true }),
  listMemory: () => get<MemoryRule[]>("/api/memory", mockMemory),
  saveMemory: (r: Omit<MemoryRule, "id">) => post<MemoryRule>("/api/memory", r, { ...r, id: `r-${Date.now()}` }),
  deleteMemory: (id: string) => post<{ ok: boolean }>(`/api/memory/${id}/delete`, {}, { ok: true }),
  listAudit: (q = "") => get<AuditEntry[]>(`/api/audit?q=${encodeURIComponent(q)}`, mockAudit),
  listUsage: () => get<UsageRow[]>("/api/usage", mockUsage),
  awayDigest: () => get<{ timeline: { at: string; text: string }[]; pendingApprovals: number; completed: number }>("/api/away/digest", { timeline: [{ at: "09:14", text: "Dev បានបញ្ចប់ Checkout" }], pendingApprovals: 1, completed: 2 }),
  /** Presigned upload URL for images/screenshots (S3/R2 via backend). */
  presignedUpload: (filename: string, contentType: string) => post<{ url: string; key: string }>(`/api/uploads/presign`, { filename, contentType }, { url: "", key: filename }),
  feedback: (messageId: string, vote: 1 | -1) => post<{ ok: boolean }>(`/api/feedback`, { messageId, vote }, { ok: true }),
  stopAll: () => post<{ ok: boolean }>(`/api/runner/stop-all`, {}, { ok: true }),
  runnerStatus: () => get<{ running: boolean; activeAgents: number; pendingTasks: number; pendingApprovals: number }>("/api/runner/status", { running: true, activeAgents: 3, pendingTasks: 2, pendingApprovals: 1 }),
};
