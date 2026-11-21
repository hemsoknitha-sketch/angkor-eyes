# Roadmap — Phase 0–6

> **Read this first:** **8 weeks is only a prototype / MVP for a single user.** The full production-grade system in this repo needs **~18 weeks** (Phases 0–6). Anyone promising "production in 8 weeks" is describing the MVP and skipping hardening, testing, docs, and operations. This roadmap says explicitly what each phase does and does *not* deliver.

## Summary

| Phase | Name | Duration | Cumulative | Delivers |
|---|---|---|---|---|
| 0 | Foundations | 2 weeks | 2 w | Repo, CI, compose stack, owner-only auth, audit log, skeleton services |
| 1 | Lead Agent + Memory | 3 weeks | 5 w | Planning/delegation, Shared Memory, cost meter |
| 2 | Worktrees + Approval Gate | 3 weeks | 8 w | **MVP** — worktree lifecycle, risk classifier, approvals in Telegram + Mini Web |
| 3 | Group Turn-Taking + Away Mode | 2 weeks | 10 w | Turn Coordinator, Away Mode |
| 4 | Mini Web + API + Integrations | 3 weeks | 13 w | Dashboard, Public API + keys, GitHub + webhooks |
| 5 | Hardening | 3 weeks | 16 w | Security audit, load test, backup drill, AI evals, kill switch proven |
| 6 | Production Launch | 2 weeks | 18 w | Docs site, status page, support, runbooks, go-live |

---

## Phase 0 — Foundations (2 weeks)

**Goal:** a running skeleton that is safe by default.

- Monorepo layout, TypeScript workspaces, ESLint/Prettier, CI (lint + typecheck + unit tests on every PR).
- `docker-compose.yml`: Postgres + pgvector, Redis, backend, bot, frontend (this builder's file is the starting point).
- Owner-only auth: `ALLOWED_TELEGRAM_IDS` enforced in bot + backend; unknown users get a silent drop (no info leak).
- Database migrations: `tasks`, `runs`, `messages`, `approvals`, `audit_log`, `memories`.
- Structured JSON logging + `trace_id`; `/health` endpoints; Sentry wired (DSN optional).
- Skeleton bot: `/start`, `/help`, `/status`; skeleton backend: task creation + echo run.

**Exit criteria:** `docker compose up` → all services healthy; an unknown Telegram user gets nothing; an owner message creates a task row and an audit entry.

**Non-goals:** any real agent work; worktrees; approvals UI.

**Risks:** Telegram webhook vs long-polling decision; pgvector extension availability in the chosen Postgres image.

## Phase 1 — Lead Agent + Memory (3 weeks)

**Goal:** the system can plan, delegate, remember, and report cost.

- Lead Agent: plan → steps → delegate to registered specialists (coder, researcher, writer) → synthesise.
- Shared Memory: write/read with pgvector embeddings; recall injected with citations; `/forget`.
- Specialist prompts + tool allowlists; model routing (cheap triage / strong planning; Ollama option).
- Cost meter: per-call token + USD tracking, per-run and daily totals, Mini Web cost view (basic).
- Run lifecycle: queued → running → awaiting-approval → done/failed/cancelled; resumable after restart.

**Exit criteria:** a research + writing task completes end-to-end with memory recall from a prior session; cost is visible per run; a restart resumes a queued run.

**Non-goals:** code execution in worktrees; group chats; public API.

## Phase 2 — Worktrees + Approval Gate (3 weeks) — 🎯 MVP

**Goal:** safe code work. **This is the 8-week MVP line (Phases 0–2).**

- Local Runner: outbound tunnel, signed jobs, heartbeat.
- Worktree lifecycle: create → work → diff → approve → merge → prune (`scripts/prune-worktrees.sh`).
- Risk Classifier (rules first, LLM second opinion; higher risk wins) + Approval Gate: Telegram inline buttons + Mini Web queue, 15-min expiry, audit.
- Sandboxed shell: allowlist, directory jail, timeouts, output caps.
- Diff preview in Telegram (summary) and Mini Web (full diff).

**Exit criteria:** owner asks for a code change in Telegram → worktree created → diff shown → owner approves → merged; a rejected change leaves main untouched; an unapproved medium+ tool call never executes (test asserts this).

**Non-goals:** group turn-taking; Away Mode; integrations; load testing; docs site. **The MVP is single-user, happy-path, and not yet production-hardened — say so in any demo.**

## Phase 3 — Group Turn-Taking + Away Mode (2 weeks)

**Goal:** the system behaves in groups and when you're away.

- Turn Coordinator: per-chat lock, speaker selection, turn budget, anti-loop, group allowlist (`docs/architecture.md` §3).
- Group safety: non-owner members cannot approve/merge/configure.
- Away Mode: `/away` / `/back`, auto-trigger on runner offline, queueing, return digest.
- Kill switch v1: `/kill` halts runs (proven in a drill).

**Exit criteria:** a 3-agent group conversation completes without overlap or loops; Away Mode queues work and the return digest is correct; kill switch halts a running job in < 10 s.

## Phase 4 — Mini Web + API + Integrations (3 weeks)

**Goal:** the dashboard is complete and the system connects outward.

- Mini Web: tasks, approvals (full diff), costs, logs, memory management, settings, feature flags.
- Public API (`/api/v1`) + scoped API keys (`docs/api.md`).
- Integrations: GitHub (PR from approved worktree), outbound webhooks; stubs for GitLab, Linear/Jira/Notion, Sentry (`docs/integrations.md`).
- File attachments via S3/R2; voice messages transcribed.

**Exit criteria:** every Telegram action has a Mini Web equivalent; a GitHub PR is opened from an approved merge; an outbound webhook fires on task completion.

## Phase 5 — Hardening (3 weeks)

**Goal:** prove it is safe, fast, and recoverable — not just believed.

- Security: Semgrep CI gate (`tests/security/semgrep.yaml`), dependency audit, secrets scan, threat-model review (`security/`), penetration checklist.
- Load: k6 at 100 concurrent users (`tests/load/k6-script.js`); fix the bottlenecks it finds.
- Backup/restore drill: daily dumps (`scripts/backup.sh`) + a real restore to a scratch DB (`scripts/restore.sh`), monthly thereafter.
- AI evals: Promptfoo regression suite (`tests/ai-eval/`) with LLM-as-Judge; no eval regression ships.
- Kill switch + feature flags proven end-to-end; error budgets and alerting (Grafana + Sentry).
- E2E suite green (Playwright Mini Web + bot outline).

**Exit criteria:** Semgrep + load + eval gates pass in CI; a restore drill succeeds and is documented; the kill switch drill is timed and logged.

**Non-goals:** new features. If a feature is not done by Phase 5, it slips to post-launch — hardening time is not borrowed.

## Phase 6 — Production Launch (2 weeks)

**Goal:** someone other than the builders can run and use it.

- Docs site live (Docusaurus/Mintlify — `docs/docs-site-outline.md`): quickstart, create-an-agent, write-a-good-prompt.
- Status page (`docs/status.md`), support channel (`docs/support.md`), runbooks (`docs/operations.md`).
- Go-live checklist: secrets rotated, backups verified, alerts firing, rollback tested, owner trained.
- Launch: single-user production for Sinath; 2-week hypercare (daily check-ins, fix-forward only).

**Exit criteria:** go-live checklist signed off; docs site + status page live; Sinath completes a full day of real tasks with zero data loss and zero unapproved risky actions.

## After launch (post-Phase 6, not scheduled here)

Multi-user support (if ever wanted — currently explicitly out of scope), payments (Stripe/ABA/Bakong), more integrations, agent marketplace. None of these are promised by this roadmap.

## How to track progress

- Each phase ends with a demo to Sinath + a `docs/changelog.md` entry.
- Slips move the *date*, not the exit criteria. Cutting hardening to hit a date is how production incidents happen.
