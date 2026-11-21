# Operations — ប្រតិបត្តិការ

Runbooks for keeping ANGKOR EYES alive, recoverable, and observable. If you are on call (which, for a single-user system, is Sinath + whoever Sinath asks), start here.

## 1. Backup & Restore

### Daily backup

```bash
./scripts/backup.sh
```

- Dumps Postgres with `pg_dump` (custom format), gzips it, and writes to `BACKUP_DIR` (default `./backups/`) and, if set, to `BACKUP_S3_URI`.
- **Schedule it:** `crontab -e` → `0 3 * * * /path/to/angkor-eyes/scripts/backup.sh >> /var/log/angkor-backup.log 2>&1` (03:00 daily).
- Retention: `BACKUP_RETENTION_DAYS` (default 30). Older dumps are deleted by the script.
- What is backed up: the full Postgres database (tasks, runs, approvals, memory + embeddings, audit log, API-key hashes). File attachments in S3/R2 are versioned by the bucket; local `uploads/` should be snapshotted with the host backup.
- **Verify the backup ran:** check the log line `backup ok` and that the newest file in `BACKUP_DIR` is < 25 h old. Alert if not (see §4).

### Restore

```bash
./scripts/restore.sh backups/angkor-eyes-2026-11-21T030000Z.dump.gz
```

- Restores into the compose Postgres (stops the backend first, drops + recreates the DB, restores, restarts). **Destructive on the target DB — it replaces it.** Never run against production without a fresh backup first.
- **Monthly test restore (mandatory):** restore the latest dump into a scratch database/container, run `SELECT count(*) FROM tasks; SELECT count(*) FROM memories;` and confirm the counts are sane and the backend boots against it. Record the result (date, dump, outcome) in `docs/changelog.md` or the ops log. **An untested backup is not a backup.**

### Disaster recovery targets

| Target | Value |
|---|---|
| RPO (max data loss) | 24 h (daily dumps) — tighten to 1 h with WAL archiving if needed later |
| RTO (max downtime) | 4 h for a full rebuild from a dump on a fresh host |

## 2. Worktree pruning

```bash
./scripts/prune-worktrees.sh [--dry-run] [--older-than 7d]
```

- Removes worktrees that are merged, abandoned, or whose task is done/cancelled, older than the retention window (default 7 days).
- **Never prunes:** a worktree with an open approval, a running run, or unmerged changes the owner has not decided on. `--dry-run` lists what would be removed — run it first.
- Schedule weekly: `0 4 * * 0 /path/to/angkor-eyes/scripts/prune-worktrees.sh`.
- Also deletes the remote-tracking branch cleanup: `git worktree prune` + `git branch -d` for fully-merged task branches.

## 3. Observability

### Logs

- Structured JSON, one event per line, fields: `ts`, `level`, `service`, `trace_id`, `run_id?`, `msg`. Never log secrets, tokens, or full message content containing credentials.
- `docker compose logs -f backend bot runner` for live tailing.

### Traces — OpenTelemetry

- One trace per run; spans per agent turn and tool call. Exporter: `OTEL_EXPORTER_OTLP_ENDPOINT` (empty = tracing off, logs still carry `trace_id`).
- Use traces to answer "why did this run take 4 minutes / cost $1.20?".

### Metrics & dashboards — Grafana

Suggested panels (create in Grafana once it is wired):

- Runs started / completed / failed (per hour)
- Approval latency (request → decision) — alert if p95 > 30 min
- Cost per day vs `DAILY_BUDGET_USD`
- Queue depth (BullMQ waiting jobs) — alert if > 50 for 10 min
- Runner heartbeat age — alert if > 5 min (means Away Mode is about to trigger)
- LLM error rate by provider

### Errors — Sentry

- `SENTRY_DSN` in `.env` enables Sentry in backend, bot, frontend, runner. Triage new issues daily during hypercare, weekly after.
- Sentry must never receive message content with secrets — the SDK is configured to scrub `TELEGRAM_BOT_TOKEN`, `*_API_KEY`, and `*_SECRET` patterns.

### Alerts (minimum viable)

| Alert | Condition | Action |
|---|---|---|
| Backup stale | No `backup ok` in 25 h | Investigate disk / cron |
| Runner offline | Heartbeat > 5 min | Check runner host; system enters Away Mode |
| Daily budget 80% | Cost ≥ 80% of `DAILY_BUDGET_USD` | Notify owner in Telegram |
| Approval p95 high | p95 approval latency > 30 min | Nudge owner; check Telegram delivery |
| Error spike | > 10 Sentry errors / 10 min | Check logs; kill switch if agents are looping |

## 4. Kill Switch

**What it does:** halts all runs as fast as possible — in-flight tool calls are cancelled where possible, queued jobs are paused, no new runs start.

**How to trigger:**

- Telegram: `/kill <reason>` (owner only)
- Mini Web: Admin → Kill Switch
- API: `POST /api/v1/admin/kill-switch` (scope `admin`)

**How to release:** `/unkill` / Mini Web / `POST /api/v1/admin/kill-switch/release` — owner only. Releasing never auto-resumes halted runs; each must be re-started explicitly.

**Drill:** trigger the kill switch against a test run monthly (Phase 5, then quarterly). Time it: halt must complete in < 10 s. Log the drill.

## 5. Feature Flags

- Flags live in the backend (DB-backed, cached in Redis) and are toggled in Mini Web → Admin → Flags or `POST /api/v1/admin/flags/:name`.
- Ship every risky feature behind a flag (default **off**): new agents, new tools, new integrations, model changes.
- A flag flip takes effect without a deploy or restart. Every flip is audit-logged.
- Suggested starter flags: `agent.coder`, `agent.researcher`, `tool.shell`, `tool.web_fetch`, `integration.github`, `miniweb.costs_v2`.

## 6. Upgrades & rollback

1. `git pull` (or deploy the new image tag) → `docker compose up -d --build`.
2. Migrations run on backend boot; they must be backwards-compatible (expand then contract).
3. **Rollback:** `docker compose down && git checkout <previous-tag> && docker compose up -d --build`. Data migrations are never rolled back automatically — if a migration is destructive, it ships with its own reverse migration and a tested restore (see §1).

## 7. Daily / weekly / monthly checklists

- **Daily (automated):** backup ran; error count sane; cost under budget.
- **Weekly:** review failed runs; prune worktrees; review Sentry.
- **Monthly:** test restore; kill-switch drill; dependency updates; review audit log for anomalies; rotate `RUNNER_SHARED_SECRET` if the runner host changed.
