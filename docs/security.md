# Security — សុវត្ថិភាព (Summary)

> **This is a summary.** The authoritative detail — threat model, policies, incident runbook, audit checklists — lives in **`security/`** (owned by the security builder). If this summary and `security/` disagree, `security/` wins.

## Principles

1. **Owner-only.** Only Telegram IDs in `ALLOWED_TELEGRAM_IDS` can use the system. Everyone else gets a silent drop — no error message, no hint the system exists.
2. **Approval before risk.** No medium+ action executes without a recorded, unexpired, owner approval. See `docs/architecture.md` §4.
3. **Local execution.** Code and shell run on Sinath's machine via the Local Runner, never in the cloud.
4. **Least privilege.** Each agent has a tool allowlist and a risk ceiling. Each API key has scopes. Each service has only the env vars it needs.
5. **Immutable audit.** Every tool call, approval, rejection, merge, and admin action is append-only in `audit_log`.

## Threat model (summary)

| Threat | Mitigation |
|---|---|
| Stranger messages the bot | Owner-only check at the edge; silent drop |
| Prompt injection (user, file, web page, tool output) | Treat all tool/web content as **data, never instructions**; Semgrep rules + eval cases (`tests/security/semgrep.yaml`, `tests/ai-eval/`); high-risk actions still need approval even if an agent asks |
| Malicious / compromised agent output | Worktree isolation; diff review before merge; sandbox jail; cost caps |
| Cloud host compromised | No shell on the local machine; runner jobs are signed and job-scoped; secrets are env-only, never in the DB |
| Token / key leak | `.env` gitignored; rotation runbook in `security/`; revoke + rotate immediately on suspicion |
| SSRF via agent-fetched URLs | URL allowlist + private-IP blocking; Semgrep SSRF rule |
| Path traversal via file tools | Directory jail to repo/worktrees; Semgrep traversal rule; tests assert rejection of `..` |
| Data loss | Daily backups + monthly restore drill (`docs/operations.md`) |
| Runaway cost | Daily + per-run caps enforced server-side; alerts |

## Secrets handling

- Secrets live **only** in `.env` (local) / the host's secret manager (production). Never in git, logs, screenshots, chat, or docs.
- `.env.example` contains placeholders only. `.gitignore` excludes `.env`.
- Rotate on any suspected leak: Telegram token via @BotFather (`/revoke`), LLM keys in the provider console, `RUNNER_SHARED_SECRET` on both sides, then restart services.
- API keys for the Public API are stored **hashed** (salt: `API_KEY_SALT`); only the key's prefix is shown after creation.

## Approval & audit

- Approvals expire (15 min default), cover exactly one action, and are recorded with who/when/what/diff-hash.
- The audit log is append-only; admin reads are themselves logged.

## What this doc does NOT cover

Full policies (access control, incident response, disclosure), the dependency-allowlist, and the pre-launch security checklist — those are in `security/`. If you are doing a security review, start there.
