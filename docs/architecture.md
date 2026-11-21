# Architecture — ស្ថាបត្យកម្ម

> Companion to the [README](../README.md). This is the design reference for builders. Where this doc and another builder's code disagree, the code wins for behaviour and this doc should be updated — file the discrepancy in `docs/changelog.md`.

## 1. Overview

ANGKOR EYES is a **Hybrid Cloud-to-Local Bridge**:

- **Cloud** (always-on, small VPS / container host): Telegram bot, orchestrator backend, Postgres + pgvector, Redis, Mini Web frontend.
- **Local** (Sinath's machine): the Local Runner, which owns Git worktrees, sandboxed shell execution, and file tools.

The cloud **orchestrates**; the local machine **executes**. The runner initiates an outbound-only connection to the backend (via Cloudflare Tunnel / Tailscale / mutual-TLS WebSocket). No inbound ports are opened on the local machine, and the cloud never receives a shell on it.

### 1.1 Component map

| Component | Directory | Stack (intended) | Responsibility |
|---|---|---|---|
| Telegram Bot | `bot/` | grammY, TypeScript | Receives updates, renders approval cards, enforces owner-only access, Mini App button |
| Orchestrator Backend | `backend/` | Node.js 20, TypeScript, Fastify | Lead Agent, Turn Coordinator, Risk Classifier, Approval Gate, Agent Registry, REST + WebSocket API, queue, cost meter, audit log |
| Database | `db/` | Postgres 16 + pgvector | Tasks, runs, messages, approvals, memory embeddings, API keys, audit log |
| Queue / Cache | Redis 7 + BullMQ | — | Job queue for runs, rate limiting, Turn Coordinator locks |
| Mini Web | `frontend/` | React + Vite + Tailwind | Dashboard: tasks, approvals, costs, logs, memory, settings |
| Local Runner | `runner/` | Node.js, TypeScript | Git worktrees, sandboxed shell, file tools, Away Mode heartbeat |
| Security | `security/` | policies + threat model | Threat model, secrets policy, incident runbook |

### 1.2 Architecture diagram

```
Telegram App ──► Bot API ──► bot/ (grammY)
Mini Web   ──► HTTPS ──► frontend/ (static) ──► backend/ REST+WS
backend/ ──► Postgres+pgvector (memory, tasks, approvals)
backend/ ──► Redis/BullMQ (jobs, locks, rate limits)
backend/ ──► LLM providers (Anthropic / OpenAI / Gemini / Ollama)
backend/ ◄──► runner/ (outbound tunnel, mTLS + shared secret)
runner/  ──► Git worktrees + sandboxed shell on local machine
```

## 2. Request / task lifecycle

```
User message (Telegram / Mini Web)
  │ 1. Authenticate: telegram_id ∈ ALLOWED_TELEGRAM_IDS, else silent drop
  ▼
Create Task + Run (status: queued)
  │ 2. Lead Agent plans: steps, sub-agents, tools, risk estimate
  ▼
Turn Coordinator assigns turns (see §3)
  │ 3. Sub-agent executes a step (tool calls)
  ▼
Risk Classifier scores each tool call (§4)
  ├─ low      → execute immediately, log
  ├─ medium   → approval request (Telegram inline buttons + Mini Web)
  ├─ high     → approval request + diff preview required
  └─ critical → approval request + owner-only + mandatory reason
  │ 4. On approval → execute (code edits via runner worktree)
  │    On rejection / expiry → step fails safe, run continues or halts
  ▼
Result → summary to user (Khmer/English as user wrote) + cost + diff
  │ 5. Memory write: facts, decisions, preferences → pgvector
  ▼
Worktree: merge (only after approval) or prune
```

**Invariants (never break these):**

1. No medium+ tool call executes without a recorded approval.
2. No merge to a protected branch without approval.
3. Every tool call, approval, and rejection is in the immutable audit log.
4. The runner never executes a command the backend did not sign (shared secret + job ID binding).
5. Cost caps are enforced server-side; the LLM client cannot overspend by itself.

## 3. Turn-taking in group chats (Turn Coordinator)

**Problem:** in a Telegram group, several agents + humans can speak. Without coordination, agents talk over each other, loop, and spam.

**Design:**

- **One speaker at a time.** The Turn Coordinator holds a Redis lock per chat (`turn:<chat_id>`). A speaker (Lead Agent, a sub-agent, or a human "turn") must hold the lock to send.
- **Speaker selection.** Priority: (1) human message awaiting reply, (2) Lead Agent summary/decision, (3) sub-agent result that unblocks the next step, (4) background status (throttled: max 1 per 60 s per chat).
- **Turn budget.** Max 5 agent messages per user message in a group (configurable); beyond that the Lead Agent must summarise and stop.
- **Anti-loop.** If the same agent would speak twice in a row with no new information, or the same tool is called 3× with the same args, the run pauses and asks the owner.
- **Group allowlist.** Only groups in `ALLOWED_GROUP_IDS` get agent replies; in other groups the bot stays silent. Group members other than the owner cannot approve, merge, or change settings — approvals are owner-only even in groups.
- **Human interruption.** Any owner message in the group pre-empts the current turn; the run pauses and the Lead Agent re-plans.

State machine per chat: `idle → lead-speaking → agent-speaking → awaiting-human → idle`. All transitions are logged.

## 4. Risk Classifier + Approval Gate

| Risk | Examples | Handling |
|---|---|---|
| **low** | Read a file, search the web, summarise, list tasks | Execute immediately |
| **medium** | Edit a file in a worktree, install a dev dependency, send a draft message | Approval required (single tap) |
| **high** | Merge a worktree, deploy, run a shell command with side effects, spend money, send a message externally | Approval + diff/preview required |
| **critical** | Delete data, change credentials/secrets, modify the approval system itself, disable safety | Approval + typed reason + owner-only; logged as critical |

- **Approval expiry:** 15 minutes by default (`APPROVAL_TTL_MINUTES`). Expired approvals fail safe (deny).
- **Approval scope:** one approval covers exactly one tool call / one diff — never a blanket "approve everything".
- **UI:** Telegram inline keyboard (✅ Approve / ❌ Reject / ℹ️ Details) + Mini Web approval queue with full diff view.
- **Audit:** every approval/rejection records who, when, what (tool, args hash, diff hash), and the risk level.

The classifier is a deterministic rules layer first (tool + args patterns), with an LLM second opinion for ambiguous cases. If the two disagree, the **higher** risk wins. See `tests/unit/risk-classifier.test.ts` for the contract.

## 5. Shared Memory

- **Store:** Postgres + pgvector. Tables (intended, owned by `db/`): `memories` (id, owner_id, kind, text, embedding, source, created_at, updated_at, expires_at), plus `tasks`, `runs`, `messages`, `approvals`, `audit_log`.
- **Kinds:** `fact`, `preference`, `decision`, `task-summary`, `correction`.
- **Recall:** on each new task, retrieve top-k memories by embedding similarity + recency, inject into the Lead Agent's context (with source citations shown to the owner on request).
- **Correction & deletion:** owner can correct (`/forget <thing>`, Mini Web memory tab) or delete all data ("Delete My Data" — see `docs/privacy-terms.md`). Deletion removes rows and embeddings; backups age out per the retention schedule.
- **Isolation:** single-owner system — all memory is scoped to the owner's ID. No cross-user leakage is possible by construction, and tests assert it.

## 6. Lead Agent + Agent Registry

- **Lead Agent:** plans (steps, dependencies, owners), delegates, synthesises results, handles failures (retry once with a different approach, then escalate to owner).
- **Specialists (registry):** `coder`, `researcher`, `writer`, `ops`, `reviewer`. Each has a system prompt, allowed tools, max cost, and a risk ceiling. New agents are added by registering a prompt + tool allowlist + tests — see `docs/docs-site-outline.md` ("Create an agent").
- **Model routing:** cheap model for triage/summaries, strong model for planning/code; local Ollama for private drafts. All routing is configurable per agent.

## 7. Local Runner & Tunnel

- The runner is a small daemon on Sinath's machine. It polls (or holds a WebSocket to) the backend for jobs, each job bound to a worktree.
- **Worktree lifecycle:** `create (git worktree add)` → work → `diff` → approval → `merge` (or `prune`) — see `tests/integration/worktree-lifecycle.test.ts` and `scripts/prune-worktrees.sh`.
- **Sandbox:** shell commands run with a restricted allowlist, a working-directory jail (`RUNNER_REPO_PATH` + worktrees only), no network by default, timeouts, and output caps. Anything outside the jail is rejected before execution.
- **Tunnel:** Cloudflare Tunnel (or Tailscale) — the runner dials out with a token; the backend never initiates a connection to the runner's machine. Runner auth: `RUNNER_SHARED_SECRET` + per-job signature. Rotate the secret if the runner host is ever compromised.
- **Offline / Away Mode:** if the runner heartbeat is stale > 5 min, the backend marks it `away`: code jobs queue, the bot tells the owner, and nothing is silently dropped. See §8.

## 8. Away Mode

Triggered manually (`/away`) or automatically (runner offline, or owner-set schedule).

- **Behaviour:** no risky actions; new tasks are acknowledged + queued; the bot replies with status only ("I'm away — 3 tasks queued, nothing risky will run").
- **Return summary:** on `/back`, the owner gets a digest: queued tasks, what was done safely, what needs approval, costs.
- **Guarantee:** Away Mode cannot be exited by anyone except the owner, and exiting never auto-approves queued risky work.

## 9. Cost controls

- **Metering:** every LLM call records model, tokens in/out, and USD cost on the run.
- **Caps:** `DAILY_BUDGET_USD` (default 10) and `MAX_RUN_COST_USD` (default 2). Hitting a cap pauses the run and notifies the owner. Caps are enforced in the backend, not the client.
- **Visibility:** Mini Web cost tab (per run, per day, per agent) + a daily summary message.

## 10. API surface (summary)

Full contract: `docs/api.md`. In brief: REST under `/api/v1` (tasks, runs, approvals, memory, costs, admin/kill-switch), WebSocket `/ws` for live run streams, Telegram webhook/long-polling for the bot, and outbound webhooks for integrations. Auth: owner session (Telegram login) for Mini Web; scoped API keys for programmatic access.

## 11. Observability

- **Logs:** structured JSON, one line per event, `trace_id` on every line.
- **Traces:** OpenTelemetry — one trace per run, spans per agent turn and tool call.
- **Metrics:** run latency, cost, approval latency, queue depth, runner heartbeat.
- **Errors:** Sentry (backend, bot, frontend, runner). See `docs/operations.md`.

## 12. Failure modes

| Failure | Behaviour |
|---|---|
| LLM provider down | Retry with fallback provider/model once; then pause run, notify owner |
| Postgres down | Backend `/health` fails; bot replies "system unavailable, your message is queued in Telegram" — no silent loss |
| Redis down | Queue pauses; in-flight runs finish or fail safe; no new runs start |
| Runner offline | Away Mode (§8); code jobs queue |
| Approval expires | Deny; run continues with remaining safe steps or halts |
| Kill switch | All runs halt within seconds; in-flight tool calls are cancelled where possible |

## 13. Security summary

Owner-only auth, approval-before-risk, local execution, signed runner jobs, immutable audit log, secrets only via env. Full detail: `docs/security.md` + `security/`.
