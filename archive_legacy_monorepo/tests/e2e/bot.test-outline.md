# E2E — grammY Bot Test Outline

> **Outline, not a runnable spec** — the bot builder owns the runnable
> harness. This file defines what must be covered, so the outline can be
> turned into tests without re-deciding the cases.

## Harness

- grammY `Bot` instance with a **mocked Telegram API** (no network, no
  real Bot Token): use grammY's test utilities / a stubbed `api` object
  that records outgoing calls (`sendMessage`, `editMessageText`,
  `answerCallbackQuery`, `sendChatAction`).
- In-memory (or Testcontainers) backend doubles for task creation and
  approvals, following the contracts in `docs/api.md`.
- Owner ID in tests: `111111` (`ALLOWED_TELEGRAM_IDS=111111`).
  Stranger ID: `999999`.

## Cases

### 1. Owner-only access

| # | Input | Expected |
|---|---|---|
| 1.1 | Stranger sends `/start` | No reply at all (silent drop); nothing logged with content |
| 1.2 | Stranger sends a task | No reply; no task row created |
| 1.3 | Owner sends `/start` | Welcome message in the language of the owner's last message (default English) |
| 1.4 | Owner sends `/help` | Help text listing commands |

### 2. Task creation

| # | Input | Expected |
|---|---|---|
| 2.1 | Owner: "Summarise this repo's README" | Task created; acknowledgement message with task ID; run starts |
| 2.2 | Owner sends a voice message | Transcription attempted; task created from the transcript |
| 2.3 | Owner sends a photo + caption | Task created with the attachment referenced |
| 2.4 | Owner sends an empty message | Polite "I didn't catch that" reply, no task created |

### 3. Approval cards

| # | Input | Expected |
|---|---|---|
| 3.1 | Medium-risk step reached | Inline keyboard: ✅ Approve / ❌ Reject / ℹ️ Details; message shows tool + summary |
| 3.2 | Owner taps ✅ Approve | `answerCallbackQuery` "Approved"; approval row = approved; run resumes |
| 3.3 | Owner taps ❌ Reject | Approval row = rejected; run fails safe with a message to the owner |
| 3.4 | Stranger taps ✅ Approve (callback from another user) | Rejected silently; approval unchanged; audit log notes the attempt |
| 3.5 | Owner taps ✅ after expiry (15 min) | "This approval expired" message; approval = expired; no execution |

### 4. Kill switch & Away Mode

| # | Input | Expected |
|---|---|---|
| 4.1 | Owner: `/kill testing` | All runs halt; confirmation message; new tasks are refused with "stopped" |
| 4.2 | Stranger: `/kill` | Silent drop |
| 4.3 | Owner: `/away` then sends a task | "I'm away — queued" reply; task queued, nothing risky runs |
| 4.4 | Owner: `/back` | Return digest: queued tasks, what needs approval |

### 5. Group chats

| # | Input | Expected |
|---|---|---|
| 5.1 | Agent replies in an allowlisted group | At most one agent message per turn; no overlap (see `tests/unit/turn-coordinator.test.ts`) |
| 5.2 | Bot in a non-allowlisted group | Silent |
| 5.3 | Non-owner group member taps ✅ Approve | Ignored (see 3.4) |

### 6. Language

| # | Input | Expected |
|---|---|---|
| 6.1 | Owner writes in Khmer | Bot replies in Khmer |
| 6.2 | Owner writes in English | Bot replies in English |
| 6.3 | Owner mixes both | Bot replies in the language of the majority of the message |

## Running

Once the bot builder lands the harness, run with `npm run test:e2e:bot`
from `tests/`. Until then, this outline is the spec — do not mark bot
E2E as "done" without these cases passing.
