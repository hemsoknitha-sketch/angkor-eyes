# Privacy Policy + Terms — គោលការណ៍ឯកជនភាព និងលក្ខខណ្ឌ

> **Status: draft for Sinath's review, not legal advice.** ANGKOR EYES is a single-owner system. This document states what the system does with Sinath's data in plain language (Khmer + English). If the system is ever opened to other users, get a lawyer to review this before launch.

*Last updated: 2026-11-21.*

## Privacy Policy (short version)

- **Who we are:** ANGKOR EYES is a personal agent system operated by Sinath, for Sinath. There is no company collecting your data and no advertising.
- **What is collected:** your Telegram messages to the bot (text, voice, photos, files), task history, approvals, agent logs, memory entries the system writes about your preferences/decisions, and usage/cost metadata. Voice messages are transcribed; the transcription is stored with the task.
- **What is NOT collected:** data from anyone else. The bot only responds to your Telegram ID; messages from other people are dropped and not stored.
- **Where it lives:** Postgres + pgvector and Redis on the host you control; file attachments in S3/R2 (bucket you control) or local `uploads/`; logs on the host. LLM providers (Anthropic / OpenAI / Gemini / Ollama) receive the prompts needed to do a task — see "Sub-processors" below.
- **What it is used for:** doing the tasks you ask for, remembering your preferences so you don't repeat yourself, showing you costs, and keeping an audit log so you can see what the agents did.
- **Who it is shared with:** nobody, except (a) the LLM provider processing a prompt, (b) an integration you explicitly connect (e.g. GitHub), and (c) an outbound webhook URL you configure. No sale of data, ever.
- **Sub-processors:** the LLM provider you choose in `.env` (`LLM_PROVIDER`). Each has its own data policy — read it before choosing. Local Ollama sends nothing off your machine.
- **Retention:** see the schedule below. You can export or delete your data at any time (see "Your rights").

## Data Retention

| Data | Retention | Notes |
|---|---|---|
| Tasks, runs, messages | 12 months, then auto-delete | Needed for history + debugging |
| Approvals + audit log | 24 months | Needed to prove what was approved |
| Memory entries | Until you delete/correct them | You control these |
| Cost records | 24 months | Needed for spend history |
| Backups (Postgres dumps) | 30 days rolling | Older dumps deleted by `scripts/backup.sh` |
| Logs (JSON) | 30 days | Rotated by the host |
| Deleted data | Removed from live DB immediately; gone from backups when they age out (≤ 30 days) | State this honestly — backups cannot be rewritten |

## Your rights — Delete My Data (GDPR / CCPA note)

ANGKOR EYES is built for one person, but it follows the same principles as GDPR (EU) and CCPA (California):

- **Access / export:** Mini Web → Settings → Export My Data, or `POST /api/v1/memory/export`. You get a JSON file of your tasks, memory, approvals, and cost records.
- **Correction:** edit or correct any memory in Mini Web → Memory, or send `/forget <thing>`.
- **Deletion ("Delete My Data"):** Mini Web → Settings → Delete My Data, or `DELETE /api/v1/memory/all`, or tell the bot `delete all my data`. This deletes your tasks, runs, messages, memories (including embeddings), approvals, and cost records from the live database, revokes your API keys, and stops the bot responding to you. It does **not** instantly erase backups — those age out within 30 days (see above) — and it does not erase anything you separately published (e.g. a merged GitHub PR).
- **Confirmation:** deletion asks for confirmation twice (button + typed confirmation) because it is irreversible.
- **Response time:** export/deletion completes within minutes for a single-user system; the confirmation message states exactly what was deleted and what remains only in backups.

## Terms of Use (short version)

- **The service:** ANGKOR EYES is a personal agent. It acts on your instructions, within the approval rules you set. It is not a lawyer, doctor, or financial adviser, and its outputs should be checked before you rely on them.
- **Your responsibilities:** keep your Telegram account, bot token, and API keys secret; review diffs before approving merges; don't ask the system to do anything illegal or to harm others.
- **Approvals are yours:** approving a merge, a payment, or a message is your decision. The system shows you the diff/preview; you own the outcome of an approval.
- **Availability:** the system runs on infrastructure you control; there is no uptime guarantee. Backups are daily (see `docs/operations.md`); a monthly restore is tested.
- **Costs:** LLM usage is billed by your LLM provider, not by ANGKOR EYES. Daily/per-run caps (`DAILY_BUDGET_USD`, `MAX_RUN_COST_USD`) limit spend; you are responsible for provider charges up to the caps.
- **Changes:** Sinath may change these terms; the change is recorded in `docs/changelog.md` with the date.
- **Language:** Khmer and English versions are provided; if they disagree, the English version governs for legal purposes (state this explicitly once a lawyer has reviewed it).

## Contact

Questions about your data: ask the bot (`/privacy`) or use the support channel in `docs/support.md`.
