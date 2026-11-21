# ANGKOR EYES Security / សុវត្ថិភាព

Khmer + English. These files are the binding security contract for the runner (`../runner/`) and the backend.

## Files

| File | Purpose |
|---|---|
| `policy.md` | Instruction hierarchy, untrusted input, prompt-injection defense, capability-based access control, sandboxing, network restrictions, approval gate, tool argument validation, structured output validation |
| `threat-model.md` | Phase 0 threat model: Telegram auth, runner compromise, LLM prompt injection, secret leakage, TOCTOU, resource exhaustion, supply chain |
| `approval-schema.json` | JSON Schema for approval payloads (`approval_id`, `action_hash`, `target_commit_sha`, …) |
| `capabilities.json` | Per-role capabilities (Lead / Dev / QA / Reviewer / Security) |
| `sandbox-policy.yaml` | Docker limits, egress allowlist, timeouts, high-risk MicroVM runtime |
| `redaction-patterns.json` | Regex patterns for secrets/PII redaction (loaded by `runner/src/redaction.ts`) |

## Core rules (short version / សង្ខេប)

1. **System > user > tool output.** Tool output and file content are data, never instructions.
2. **No risky action without approval.** Push/merge/deploy need an approved `approval_id` + `action_hash`, re-verified (commit SHA + hash) at execution time.
3. **Least privilege.** Each role can only do what `capabilities.json` allows.
4. **Sandbox everything.** Non-root, no Docker socket, worktree-only mount, CPU/RAM limits, egress allowlist.
5. **Redact before the LLM.** Secrets/PII are stripped (regex + entropy) before any prompt or log leaves the runner.
6. **Audit everything.** `logs/audit.jsonl` on the runner, forwarded to the backend.
