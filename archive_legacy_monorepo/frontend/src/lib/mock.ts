import type { Agent, Approval, AuditEntry, ChatMessage, MemoryRule, Room, TaskNode, UsageRow } from "./types";

/** Fallback data used only when the backend is unreachable. Real API calls run first. */
export const mockAgents: Agent[] = [
  { id: "a-lead", name: "Lead Agent", project: "angkor-eyes", role: "lead", model: "claude-sonnet-4", status: "active" },
  { id: "a-dev", name: "Dev", project: "my-shop", role: "dev", model: "claude-sonnet-4", status: "busy" },
  { id: "a-qa", name: "QA", project: "my-shop", role: "qa", model: "gpt-5-mini", status: "active" },
  { id: "a-rev", name: "Reviewer", project: "launch-day", role: "reviewer", model: "claude-sonnet-4", status: "paused" },
];
export const mockRooms: Room[] = [
  { id: "my-shop", name: "my-shop", project: "my-shop", topicId: 12 },
  { id: "launch-day", name: "launch-day", project: "launch-day", topicId: 34 },
];
export const mockMessages: ChatMessage[] = [
  { id: "m1", roomId: "my-shop", author: "Sinath", role: "user", text: "បន្ថែមទំព័រ Checkout ឲ្យហាង", at: "09:12" },
  { id: "m2", roomId: "my-shop", author: "Dev", role: "dev", text: "កំពុងសរសេរ Checkout… រង់ចាំ QA ពិនិត្យ។", at: "09:14" },
];
export const mockApprovals: Approval[] = [
  { id: "ap1", title: "Checkout page — branch feat/checkout", summary: "បន្ថែមទំព័រ Checkout + តេស្ត 4", status: "pending", roomId: "my-shop", diff: "+ src/pages/Checkout.tsx\n+ 182 lines\n- src/App.tsx\n- 3 lines" },
];
export const mockTaskTree: TaskNode[] = [
  { id: "t1", title: "Checkout page", assignee: "lead", status: "doing", children: [
    { id: "t1a", title: "សរសេរកូដ Checkout", assignee: "dev", status: "done" },
    { id: "t1b", title: "តេស្ត QA", assignee: "qa", status: "doing" },
    { id: "t1c", title: "Review កូដ", assignee: "reviewer", status: "todo" },
  ] },
];
export const mockMemory: MemoryRule[] = [
  { id: "r1", title: "ភាសា", body: "ឆ្លើយជាភាសាខ្មែរជាមុន អង់គ្លេសជាបន្ទាប់", scope: "shared" },
  { id: "r2", title: "Git", body: "គ្រប់ការផ្លាស់ប្តូរត្រូវមាន worktree + approval", scope: "shared" },
];
export const mockAudit: AuditEntry[] = [
  { id: "au1", at: "2026-11-21 09:14", actor: "Dev", action: "commit", detail: "feat/checkout — 182 lines" },
  { id: "au2", at: "2026-11-21 09:10", actor: "Sinath", action: "approve", detail: "ap0 — login flow" },
];
export const mockUsage: UsageRow[] = [
  { agent: "Dev", day: "2026-11-21", tokens: 48200, costUsd: 1.42, project: "my-shop" },
  { agent: "QA", day: "2026-11-21", tokens: 12400, costUsd: 0.31, project: "my-shop" },
  { agent: "Lead Agent", day: "2026-11-20", tokens: 30100, costUsd: 0.88, project: "angkor-eyes" },
];
