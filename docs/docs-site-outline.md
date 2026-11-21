# Docs Site Outline — Docusaurus / Mintlify

## Choice

- **Recommended: Docusaurus** (static, versioned, search, Khmer-friendly, free, self-hostable) — or **Mintlify** if Sinath prefers a hosted, prettier setup with less maintenance. Either way the content below is the same; pick one in Phase 6 and don't maintain both.
- **Languages:** English + Khmer. Ship English first; Khmer pages follow per section (the README already models the bilingual pattern).
- **Source of truth:** the `docs/` files in this repo are the content; the site is a rendering of them plus the guides below. Never let the site and `docs/` drift — the site build pulls from `docs/`.

## Information architecture

```
Home
├── Getting Started
│   ├── What is ANGKOR EYES?
│   ├── Quickstart (5 minutes)
│   ├── Secrets you need (BotFather, your Telegram ID, LLM key)
│   └── First task (walkthrough with screenshots)
├── Guides
│   ├── Write a good prompt          ← see outline below
│   ├── Create an agent             ← see outline below
│   ├── Approve safely (diffs, risk levels)
│   ├── Use Away Mode
│   ├── Manage memory (/forget, corrections)
│   ├── Understand costs & budgets
│   └── Use the Mini Web dashboard
├── Concepts
│   ├── How the Lead Agent plans
│   ├── Turn-taking in group chats
│   ├── Git worktrees & the approval gate
│   ├── Shared memory (pgvector)
│   ├── Risk classifier
│   └── The Local Runner & the tunnel
├── Reference
│   ├── Public API (from docs/api.md)
│   ├── API keys & scopes
│   ├── Webhooks (outbound events)
│   ├── Environment variables (.env.example)
│   ├── CLI / scripts (install, backup, restore, prune)
│   └── Feature flags
├── Integrations
│   ├── GitHub / GitLab
│   ├── Linear / Jira / Notion
│   ├── Sentry
│   ├── Payments: Stripe / ABA / Bakong
│   └── Outbound webhooks
├── Operations
│   ├── Backup & restore (+ monthly drill)
│   ├── Observability (logs, traces, Grafana, Sentry)
│   ├── Kill switch & feature flags
│   └── Runbooks (runner offline, DB down, budget hit)
├── Security & Privacy
│   ├── Security summary (from docs/security.md)
│   ├── Privacy Policy & Terms (from docs/privacy-terms.md)
│   └── Delete My Data
└── Support
    ├── Support channel (from docs/support.md)
    ├── Status page (from docs/status.md)
    └── FAQ
```

## Guide outline: "Write a good prompt"

1. **Say the outcome, not the method** — "make the login page load faster" beats "add an index to users.email".
2. **Give context the agent can't guess** — repo, file, or link; what "done" looks like; what NOT to touch.
3. **One task per message** — the Lead Agent plans better with a single goal.
4. **State the risk appetite** — "draft only, don't merge" vs "fix and merge if tests pass".
5. **Khmer or English, either works** — write the way you think; the agent replies in the language you used.
6. **Example good / bad prompts** (3 pairs, real examples from Sinath's usage once live).
7. **When the agent gets it wrong** — how to correct it (`/forget`, rephrase, approve/reject) so memory improves.

## Guide outline: "Create an agent"

1. **When to create one** — a repeated job with its own tools, prompt, and risk ceiling (e.g. "release-notes writer").
2. **The agent definition** — name, purpose (1 sentence), system prompt, allowed tools, risk ceiling, model + cost cap.
3. **Register it** — where the definition lives (`backend/` agent registry), the file to add, and the test to write (unit test for its tool allowlist + an eval case in `tests/ai-eval/`).
4. **Try it safely** — run it on a draft task, review its first outputs, tighten the prompt.
5. **Ship behind a flag** — enable via feature flag for one task, then generally.
6. **Retire it** — disable the flag, remove the registration, note it in `docs/changelog.md`.

## Publishing checklist (Phase 6)

- [ ] One tool chosen (Docusaurus or Mintlify), build passing in CI
- [ ] Search works; Khmer pages render correctly
- [ ] Every `docs/*.md` file is linked from the site (no orphan docs)
- [ ] Versioning on (v1 docs frozen at launch)
- [ ] Link checked (no dead links) before go-live
