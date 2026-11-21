# ANGKOR EYES — Backend / ផ្នែកខាងក្រោយ

Production-grade backend for the ANGKOR EYES multi-agent platform (Khmer/English).
Fastify + TypeScript + PostgreSQL (source of truth) + Redis/BullMQ (queue, locks, realtime only).

## Run / របៀបដំណើរការ

```bash
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, TELEGRAM_BOT_TOKEN, ALLOWED_TELEGRAM_IDS
npm install
npm run dev            # ts-node-dev, port 3000
# or
npm run build && npm start
```

PostgreSQL needs the `pgvector` extension and the schema in `../db/schema.sql`
(or the migrations in `../db/migrations/`):

```bash
psql "$DATABASE_URL" -f ../db/schema.sql
```

## API

All `/api/*` routes require Telegram WebApp `initData` in the
`x-telegram-init-data` header (HMAC-SHA256 validated, whitelist enforced).
Webhooks live under `/webhooks/*` and are signature-verified.

| Area | Routes |
| --- | --- |
| Health | `GET /health` |
| Projects | `/api/projects` (+ `/dag/standard` to spawn the Frontend+Backend → Integration → Reviewer → QA → Lead DAG) |
| Agents | `/api/agents` (+ `/templates`, capabilities) |
| Rooms / messages | `/api/rooms` (+ branching/regenerate, turn-taking) |
| Tasks / DAG | `/api/tasks` (+ transition / pause / resume / cancel, dead-letter, `/api/search`) |
| Approvals (TOCTOU-proof) | `/api/approvals` |
| Shared memory | `/api/memories` (+ `/extract`, `/approve`, prompt-block) |
| Away mode | `/api/away` (+ `/digest` welcome-back) |
| Usage / feedback / flags | `/api/usage`, `/api/feedback`, `/api/feature-flags` |
| Audit | `/api/audit-logs` (append-only) |
| API keys / outbound webhooks | `/api/api-keys` |
| Webhooks in | `/webhooks/github`, `/webhooks/gitlab`, `/webhooks/{linear,jira,notion}`, `/webhooks/sentry`, `/webhooks/stripe`, `/webhooks/aba`, `/webhooks/bakong`, `/webhooks/telegram` |
| Live events | `WS /ws/rooms/:roomId` — `agent_status` / `agent_queue` |

## Key rules / ច្បាប់សំខាន់ៗ

- **PostgreSQL is the source of truth.** Redis holds only queues, the
  `room_lock:<room_id>` turn lock, and realtime pub/sub.
- **Policy engine, not the LLM, decides permissions.** See
  `src/services/policy-engine.ts` (Lead: no push; Dev: no merge main;
  QA: no prod edits; Reviewer: no push/merge; Security: no deploy).
- **Risky actions need approval**, and approvals are TOCTOU-proof:
  `action_hash` + `target_commit_sha` are re-verified before execution.
- **Kill switch:** `STOP_ALL=true` halts all agent mutations (503).
- **Audit logs are append-only** and secrets are redacted before storage.
- **Idempotency:** Telegram `update_id` is deduped; API keys are stored
  as SHA-256 hashes and shown once at creation.

## Layout / រចនាសម្ព័ន្ធ

```
src/
  index.ts            entry, env validation, graceful shutdown, WS
  config.ts           zod env validation + orchestrator tunables
  lib/                db (pg pool), redis (BullMQ), logger, telemetry,
                      auth (Telegram initData HMAC), secrets-redaction,
                      prompt-injection, http helpers
  services/           turn-coordinator, task-dag, memory-engine, llm-gateway,
                      risk-classifier, approval-service, away-mode, scheduler,
                      outbox, idempotency, circuit-breaker, policy-engine,
                      merge-coordinator, evaluation, usage-tracker, notification
  routes/             agents, rooms, tasks, approvals, memory, projects,
                      away, usage, audit, webhooks, api-keys
```
