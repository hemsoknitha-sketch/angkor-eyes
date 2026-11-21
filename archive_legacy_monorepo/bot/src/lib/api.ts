/** Minimal backend client. All calls go to BACKEND_URL — never hardcoded. */
export interface BackendClientOpts { backendUrl: string; timeoutMs?: number }

export class BackendClient {
  constructor(private opts: BackendClientOpts) {}
  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 30_000);
    try {
      const res = await fetch(`${this.opts.backendUrl}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      });
      if (!res.ok) throw new Error(`Backend ${res.status} on ${path}: ${await res.text().catch(() => "")}`);
      return (await res.json()) as T;
    } finally { clearTimeout(t); }
  }
  get<T>(p: string) { return this.req<T>(p); }
  post<T>(p: string, body: unknown) { return this.req<T>(p, { method: "POST", body: JSON.stringify(body) }); }

  /** Forward a 1-on-1 task to the Lead Agent. */
  leadChat(body: { telegramId: number; chatId: number; text: string; messageId: number }) {
    return this.post<{ reply?: string; taskId?: string; summary?: string }>("/api/lead/chat", body);
  }
  getAwayDigest(telegramId: number) {
    return this.get<{ timeline: { at: string; text: string }[]; pendingApprovals: number; completed: number }>(
      `/api/away/digest?telegramId=${telegramId}`,
    );
  }
  setAway(body: { telegramId: number; away: boolean }) {
    return this.post<{ ok: boolean }>("/api/away", body);
  }
  decideApproval(body: { approvalId: string; decision: "approve" | "reject" | "not_yet"; telegramId: number; note?: string }) {
    return this.post<{ ok: boolean; message?: string }>("/api/approvals/decide", body);
  }
  getApproval(id: string) {
    return this.get<{ id: string; title: string; summary: string; diffUrl?: string; status: string }>(`/api/approvals/${encodeURIComponent(id)}`);
  }
  listRooms(telegramId: number) {
    return this.get<{ rooms: { id: string; name: string; project: string }[] }>(`/api/rooms?telegramId=${telegramId}`);
  }
  roomSummary(roomId: string) {
    return this.get<{ summary: string }>(`/api/rooms/${encodeURIComponent(roomId)}/summary`);
  }
}
