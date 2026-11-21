# Integrations

> Status: **Phase 4**. GitHub + outbound webhooks are the first integrations. Everything else below is a **stub** — the shape (auth, events, config) is defined here so builders don't invent conflicting contracts; the implementation lands in Phase 4+.

## Common rules

- Every integration is **opt-in** (env vars empty = off), **owner-only** to configure, and **behind a feature flag** (e.g. `integration.github`).
- Secrets live in `.env` only. OAuth tokens are stored encrypted, never in logs.
- Every integration action taken by an agent is a tool call — so it goes through the Risk Classifier and the Approval Gate like everything else. Connecting GitHub does **not** let an agent merge without approval.
- Every integration emits events to the audit log.

## GitHub (Phase 4 — first)

- **Auth:** `GITHUB_TOKEN` (fine-grained PAT, scope: contents + pull_requests on the target repo(s) only) or a GitHub App.
- **What it does:** open a PR from an approved worktree merge (branch `angkor-eyes/<task-id>`, title + body from the task), post the PR link back to Telegram, comment the diff summary.
- **Approval:** creating the PR is **high** risk — requires approval. Merging the PR on GitHub is a human act outside the system.
- **Webhook (inbound):** `GITHUB_WEBHOOK_SECRET` validates PR events (merged/closed) → the backend marks the task done and prunes the worktree.
- **Config:** `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`.

## GitLab (stub)

- Same shape as GitHub: `GITLAB_TOKEN` (project token, `api` scope on target project), merge-request creation from an approved worktree, inbound webhook with `GITLAB_WEBHOOK_SECRET`. Implementation after GitHub.

## Linear / Jira / Notion (stubs)

| Integration | Auth | What it will do |
|---|---|---|
| Linear | `LINEAR_API_KEY` | Create / comment on an issue from a task; link task ↔ issue; post completion |
| Jira | `JIRA_BASE_URL` + `JIRA_USER_EMAIL` + `JIRA_API_TOKEN` | Same as Linear, via Jira REST API |
| Notion | `NOTION_API_KEY` | Write a task summary / meeting notes to a Notion page or database |

All three are **medium** risk (external write) → approval required. Read-only sync (e.g. pulling an issue description into a task) is **low** risk.

## Sentry (stub)

- **Auth:** Sentry DSN already covers error reporting (`SENTRY_DSN`). The integration adds: "create a task from a Sentry issue" — paste an issue link, the Lead Agent triages it, proposes a fix in a worktree.
- **Config:** `SENTRY_DSN` (+ a Sentry API token when the triage feature lands).

## Payments — Stripe / ABA / Bakong (stubs, Phase 4+ only if billing is enabled)

- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`. Usage: metered billing / top-ups if Sinath ever charges for the system. Any charge is **critical** risk → approval + reason required.
- **ABA PayWay:** `ABA_MERCHANT_ID`, `ABA_API_KEY` — Cambodia card/QR payments.
- **Bakong:** `BAKONG_API_KEY` — Cambodia KHQR payments.
- **Rule:** payments are never enabled by default. Enabling billing is a Phase 4+ decision by Sinath, with its own security review. No payment code runs until then.

## Outbound Webhooks (ready — Phase 4)

The backend POSTs task events to every URL in `OUTBOUND_WEBHOOK_URLS` (comma-separated).

- **Events:** `task.created`, `task.completed`, `task.failed`, `approval.requested`, `approval.decided`, `run.cost_alert`.
- **Payload:** `{ "event": "task.completed", "api_version": "v1", "at": "<ISO-8601>", "task": { "id": "...", "title": "...", "status": "..." }, ... }`
- **Auth:** HMAC-SHA256 signature in `X-Angkor-Signature` over the raw body, key `OUTBOUND_WEBHOOK_SECRET`. Receivers must verify it and reject unsigned deliveries.
- **Delivery:** at-least-once, exponential backoff (1s, 5s, 30s, 5min), max 5 attempts; failed deliveries are logged and visible in Mini Web → Integrations.
- **Receiver contract:** respond `2xx` within 10 s; be idempotent on `task.id` + `event` (deliveries may repeat).
