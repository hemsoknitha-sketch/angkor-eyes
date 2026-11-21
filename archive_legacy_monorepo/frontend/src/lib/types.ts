export type AgentRole = "lead" | "dev" | "qa" | "reviewer" | "advisor";
export interface Agent { id: string; name: string; project: string; role: AgentRole; model: string; status: "active" | "paused" | "busy"; }
export interface Room { id: string; name: string; project: string; topicId?: number; archived?: boolean; }
export interface ChatMessage { id: string; roomId: string; author: string; role: AgentRole | "user"; text: string; at: string; feedback?: 1 | -1; }
export interface Approval { id: string; title: string; summary: string; diff: string; status: "pending" | "approved" | "rejected" | "not_yet"; roomId: string; }
export interface TaskNode { id: string; title: string; assignee: AgentRole; status: "todo" | "doing" | "done" | "blocked"; children?: TaskNode[]; }
export interface MemoryRule { id: string; title: string; body: string; scope: "shared" | "project"; }
export interface AuditEntry { id: string; at: string; actor: string; action: string; detail: string; }
export interface UsageRow { agent: string; day: string; tokens: number; costUsd: number; project: string; }
