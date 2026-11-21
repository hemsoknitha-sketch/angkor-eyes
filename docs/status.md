# Status Page — Outline

## Purpose

A public (or owner-only) page that answers, at a glance: **is ANGKOR EYES up, and if not, what is wrong and what is being done?** For a single-owner system this can be a simple static page; it does not need a third-party status provider on day one.

## Hosting options

| Option | When to use |
|---|---|
| Static page served by the frontend service (`/status`) | Day one — no extra infra |
| Separate static host (e.g. Cloudflare Pages) | If the main host itself can go down and you still want the page up |
| Third-party (e.g. Better Stack / Instatus) | Post-launch, if Sinath wants external monitoring |

Recommendation: start with the static page on the frontend service; move it to a separate host in Phase 6 if the main host proves flaky.

## Page contents

- **Overall status banner:** Operational / Degraded / Outage / Maintenance.
- **Components** (each with its own status + uptime % over 30 days):
  - Telegram Bot
  - Orchestrator Backend / API
  - Mini Web
  - Database (Postgres + pgvector)
  - Queue (Redis)
  - Local Runner (incl. last heartbeat)
  - LLM provider(s) (per provider)
- **Active incidents:** title, started at, impact, updates (timestamped), status (investigating / identified / monitoring / resolved).
- **Scheduled maintenance:** date, window, expected impact.
- **History:** past 90 days of incidents + uptime.
- **Subscribe:** Telegram notification on status change (owner only) — no email list for a single-user system.

## How status is determined

- **Automated:** a health checker (cron, every 60 s) hits `/health` on the backend, the bot's liveness, Postgres `pg_isready`, Redis `PING`, and the runner heartbeat age. A component is "down" after 3 consecutive failures.
- **Manual:** Sinath (or the on-call helper) can post an incident / maintenance notice from Mini Web → Admin → Status. Every manual change is logged.
- **LLM provider status:** link out to the provider's own status page (Anthropic / OpenAI / Google Cloud) rather than re-reporting it.

## Incident communication template

```
Title: <short, plain-language title>
Started: <time, Asia/Phnom_Penh>
Impact: <what Sinath can / cannot do right now>
What we know: <1–2 sentences>
Next update: <time or "when we know more">
```

## Uptime targets (to be set at Phase 6 go-live)

| Component | Target |
|---|---|
| Backend + Bot + Mini Web | 99.5% monthly (single small host — be honest, don't promise 99.99%) |
| Local Runner | Best effort — it depends on Sinath's machine being on; Away Mode covers the gap |

Do not publish an uptime target you have not measured for at least a month.
