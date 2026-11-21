import type { Context } from "grammy";
import type { BackendClient } from "./lib/api.js";

export interface SessionData {
  away: boolean;
  lastTaskId?: string;
  /** Room (project) id the user is currently talking about, if any. */
  roomId?: string;
}

/** grammY context extended with our services. */
export type AppContext = Context & {
  backend: BackendClient;
  session: SessionData;
  /** Telegram user id, when known. */
  telegramId?: number;
};

export interface ApprovalPayload {
  id: string;
  title: string;
  summary: string;
  diffUrl?: string;
  roomId?: string;
}
