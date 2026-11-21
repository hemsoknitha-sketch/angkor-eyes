# Support — ជំនួយ

## Support channel

ANGKOR EYES is a single-owner system, so support is deliberately small:

1. **In Telegram (fastest):** message the bot with `/support <your problem>` — it creates a support task the Lead Agent triages (logs, recent errors, what changed) and replies with what it found. If it can't fix it, it drafts a summary for a human to look at.
2. **Telegram group (optional):** a private group with Sinath + the human helper(s) Sinath trusts. The bot is **not** in this group by default — add it only if Sinath asks, and only with the group allowlist (`ALLOWED_GROUP_IDS`) updated. Use the group for outages and anything the bot can't answer.
3. **In Mini Web:** Dashboard → Help → "Report a problem" — same as `/support`, with screenshots/logs attached automatically.

**What NOT to do:** never paste a token, password, API key, or the contents of `.env` into any support message, group, or screenshot. If a log contains a secret, redact it first. Support will never ask for your bot token or passwords.

## What to include in a report

- What you were trying to do (task title or message)
- What happened vs what you expected
- Time it happened (Asia/Phnom_Penh) — so logs can be found by `trace_id`
- Screenshot of the error (with secrets redacted)
- The task/run ID from Mini Web, if you have it

## Response expectations

| Severity | Meaning | Response |
|---|---|---|
| P1 — system down | Bot doesn't reply / nothing runs | Same day, kill-switch/backup checks first |
| P2 — a feature is broken | One task type fails repeatedly | Within 2 working days |
| P3 — question / improvement | How-to, prompt help, feature idea | Within a week; ideas go to the roadmap |

(These are targets for the human helper, not an SLA — there is no paid support tier.)

## Self-help first

Most issues are answered by:

- `docs/operations.md` — runner offline, backup/restore, kill switch
- `docs/architecture.md` §12 — failure modes
- Status page — `docs/status.md`
- `/status` in Telegram — live health of backend, runner, and budget

## Escalation

If the bot itself is down, check the status page / `docker compose ps` on the host, then message the human helper directly in the support group. If data may be lost, **do not** restart things blindly — take a backup first (`./scripts/backup.sh`), then follow `docs/operations.md` §1.
