import { io, type Socket } from "socket.io-client";
import { BACKEND_URL } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (!BACKEND_URL) return null; // no backend configured — live events disabled, UI still works
  if (!socket) {
    socket = io(BACKEND_URL, { transports: ["websocket", "polling"], reconnection: true });
    socket.on("connect_error", () => undefined); // silent — mock fallback covers UI
  }
  return socket;
}

export type LiveEvents = {
  typing: (p: { roomId: string; agent: string }) => void;
  "message:new": (p: { roomId: string; text: string; author: string }) => void;
  "queue:update": (p: { roomId: string; queue: string }) => void; // e.g. "Advisor waits for QA, then answers"
  "approval:new": (p: { id: string; title: string }) => void;
};
