# Changelog

All notable changes to ANGKOR EYES, newest first. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) (Added / Changed / Fixed / Security / Removed).

## [Unreleased]

### Added

- Repository skeleton: `README.md` (Khmer + English), `docker-compose.yml` (postgres + pgvector, redis, backend, bot, runner profile, frontend), `.env.example`, `.gitignore`.
- Documentation set: `docs/architecture.md`, `docs/roadmap.md` (Phase 0–6), `docs/security.md`, `docs/api.md`, `docs/operations.md`, `docs/privacy-terms.md`, `docs/status.md`, `docs/docs-site-outline.md`, `docs/integrations.md`, `docs/support.md`.
- Test suites: unit (turn-coordinator, risk-classifier), integration (approval flow, worktree lifecycle — Testcontainers), E2E (Playwright Mini Web + grammY bot outline), load (k6, 100 concurrent users), security (Semgrep), AI eval (Promptfoo + LLM-as-Judge).
- Ops scripts: `scripts/install.sh`, `scripts/backup.sh`, `scripts/restore.sh`, `scripts/prune-worktrees.sh`.
- Roadmap honesty note: 8 weeks = prototype/MVP (Phases 0–2); full production-grade = ~18 weeks (Phases 0–6).

## [0.1.0] — 2026-11-21

### Added

- Project started. ANGKOR EYES specified: Lead Agent, group turn-taking, Git Worktree + Approval Gate, Shared Memory, Away Mode, Telegram Bot + Mini Web, for Sinath (Khmer/English).

---

<!-- How to add an entry: add a new `## [x.y.z] — YYYY-MM-DD` section above, move items out of [Unreleased], and record test-restore and kill-switch drill results here too. -->
