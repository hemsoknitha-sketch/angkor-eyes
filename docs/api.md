# Public API + API Keys

Base URL: `https://<your-backend-host>/api/v1` (local dev: `http://localhost:3000/api/v1`).
Interactive docs (when the backend builder lands them): `GET /api/docs` (OpenAPI).

## Authentication

Two mechanisms — never mix them:

| Mechanism | Used by | Header |
|---|---|---|
| **Owner session** | Mini Web (Telegram Login Widget / Mini App `initData` validation) | Cookie / `Authorization: Bearer <session>` |
| **API key** | Programmatic / integration access | `Authorization: Bearer ak_<key>` |

**API keys:**

- Created in Mini Web → Settings → API Keys (owner only) or by the bootstrap `ADMIN_API_KEY` (rotate after first use).
- Each key has **scopes** (see below) and an optional expiry. Only the key prefix is shown after creation — the full key is shown **once**.
- Keys are stored **hashed** (salt `API_KEY_SALT`). A leaked key is revoked in Mini Web; revocation is immediate.
- Rate limit: 100 req/min per key (429 beyond). All API access is audit-logged.

### Scopes

| Scope | Allows |
|---|---|
| `tasks:read` | List / get tasks and runs |
| `tasks:write` | Create tasks |
| `approvals:read` | List / get approvals |
| `approvals:write` | Approve / reject (owner-equivalent — grant sparingly) |
| `memory:read` | Search memory |
| `memory:write` | Add / correct / delete memory |
| `costs:read` | Read cost reports |
| `admin` | Kill switch, feature flags, key management |

A key with `approvals:write` is powerful — treat it like a password.

## Endpoints (outline)

> The backend builder owns the implementation. This is the **contract** tests and integrations are written against. If the backend differs, update this doc.

### Health & meta

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | none | `{"status":"ok"}` + dependency checks (db, redis, runner) |
| `GET` | `/api/v1/meta` | none | Version, feature flags, runner status |

### Tasks & runs

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/tasks` | session / `tasks:read` | List tasks (paginated, filter by status) |
| `POST` | `/api/v1/tasks` | session / `tasks:write` | Create a task `{title, prompt, source}` → `201 {task}` |
| `GET` | `/api/v1/tasks/:id` | session / `tasks:read` | Task + steps + latest run |
| `GET` | `/api/v1/tasks/:id/runs` | session / `tasks:read` | Runs for a task |
| `GET` | `/api/v1/runs/:id` | session / `tasks:read` | Run detail + step log |
| `POST` | `/api/v1/runs/:id/cancel` | session / `tasks:write` | Cancel a running run |
| `GET` | `/api/v1/runs/:id/stream` | session (WS/SSE) | Live step/token stream |

### Approvals

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/approvals` | session / `approvals:read` | Pending approvals (queue) |
| `GET` | `/api/v1/approvals/:id` | session / `approvals:read` | Approval + diff preview |
| `POST` | `/api/v1/approvals/:id/approve` | session / `approvals:write` | Approve `{reason?}` |
| `POST` | `/api/v1/approvals/:id/reject` | session / `approvals:write` | Reject `{reason}` |

Approvals expire 15 min after creation; approving an expired approval returns `410 Gone`.

### Memory

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/memory/search?q=` | session / `memory:read` | Semantic search |
| `POST` | `/api/v1/memory` | session / `memory:write` | Add a memory |
| `PATCH` | `/api/v1/memory/:id` | session / `memory:write` | Correct a memory |
| `DELETE` | `/api/v1/memory/:id` | session / `memory:write` | Delete a memory |
| `POST` | `/api/v1/memory/export` | session | Export all owner data (GDPR) |
| `DELETE` | `/api/v1/memory/all` | session | **Delete My Data** — wipes owner data (see `docs/privacy-terms.md`) |

### Costs

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/costs/summary?range=7d` | session / `costs:read` | Totals by day / agent / model |
| `GET` | `/api/v1/costs/runs/:id` | session / `costs:read` | Per-run cost breakdown |

### Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/admin/kill-switch` | session / `admin` | Halt all runs immediately `{reason}` |
| `POST` | `/api/v1/admin/kill-switch/release` | session / `admin` | Release the kill switch |
| `GET` | `/api/v1/admin/flags` | session / `admin` | Feature flags |
| `POST` | `/api/v1/admin/flags/:name` | session / `admin` | Set a flag `{enabled}` |
| `GET` | `/api/v1/admin/api-keys` | session / `admin` | List keys (prefixes only) |
| `POST` | `/api/v1/admin/api-keys` | session / `admin` | Create a key `{scopes, expires_at?}` |
| `DELETE` | `/api/v1/admin/api-keys/:id` | session / `admin` | Revoke a key |

## Errors

All errors are JSON: `{ "error": { "code": "string", "message": "human-readable (Khmer/English)", "details": {} } }`.

| Status | Meaning |
|---|---|
| 400 | Validation error |
| 401 | Missing / invalid auth |
| 403 | Authenticated but not allowed (wrong scope / not owner) |
| 404 | Not found |
| 410 | Approval expired |
| 429 | Rate limited |
| 503 | Dependency down (see `/health`) |

## Webhooks (outbound)

The backend POSTs task events to `OUTBOUND_WEBHOOK_URLS` (see `docs/integrations.md`): `task.created`, `task.completed`, `task.failed`, `approval.requested`, `approval.decided`, `run.cost_alert`. Each delivery is HMAC-signed (`OUTBOUND_WEBHOOK_SECRET`) and retried with backoff.

## Versioning

- URL versioning (`/api/v1`). Breaking changes ship as `/api/v2`; v1 is supported for ≥ 6 months after v2 launches.
- Webhook payloads carry `api_version`.
