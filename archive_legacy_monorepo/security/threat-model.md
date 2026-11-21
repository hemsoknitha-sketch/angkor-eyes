# ANGKOR EYES Threat Model — Phase 0 / គំរូគំរាមកំហែង ដំណាក់កាល 0

Scope: Telegram bot + backend + local runner + Git worktrees + Docker sandbox.
Assumptions: the operator's machine may be shared; the LLM may be tricked; the network may be observed.

## Threats & Mitigations

### 1. Telegram auth compromise
- **Threat:** attacker steals a Telegram session / impersonates Sinath and issues commands.
- **Mitigation:** Telegram login verified against the operator's Telegram ID allowlist on the backend; every privileged command requires that ID; approval actions are separate from chat commands and expire. Sessions are revocable.

### 2. Runner compromise
- **Threat:** a malicious task escapes the sandbox and owns the runner host.
- **Mitigation:** non-root container, `--cap-drop ALL`, read-only rootfs, no Docker socket, worktree-only mount, CPU/RAM/pids limits, network allowlist, timeout. High-risk tasks use a MicroVM runtime. Runner holds no long-lived credentials except its own `RUNNER_TOKEN` (rotatable, scoped to one runner).

### 3. LLM prompt injection
- **Threat:** malicious instructions hidden in code, READMEs, issues, or web content make the agent run harmful actions.
- **Mitigation:** instruction hierarchy (system > user > tool output), untrusted input labelled as data, redaction before LLM calls, command allowlist, approval gate for risky actions, audit log. See `policy.md` §2–3.

### 4. Secret leakage
- **Threat:** `.env`, SSH keys, DB passwords, or API tokens leak into logs, diffs, LLM prompts, or a pushed branch.
- **Mitigation:** secrets are never shown to agents; injected only as env vars when needed; redaction (regex + entropy) before any LLM/backend transmission; diffs are redacted; `.env*` / `*.pem` / `*.key` are blocked from agent file access; pre-push scan (planned: gitleaks-style check in the approval flow).

### 5. TOCTOU (time-of-check / time-of-use)
- **Threat:** code changes between approval and push/merge, so the approved commit is not what gets pushed.
- **Mitigation:** the runner re-verifies `target_commit_sha` + `action_hash` at execution time; any mismatch refuses the action. Merge snapshots the base SHA before merging (`runner/src/rollback.ts`).

### 6. Resource exhaustion
- **Threat:** a task loops forever, forks, or fills the disk and DoSes the host.
- **Mitigation:** sandbox limits (CPU 1.0, RAM 512 MB, pids 128, disk 1 GB tmpfs), 10-minute process timeout, heartbeat/lease timeout (90 s) so a hung runner stops claiming work, exponential backoff on reconnect.

### 7. Malicious dependency / supply chain
- **Threat:** a task adds a compromised npm/PyPI package; lifecycle scripts run arbitrary code.
- **Mitigation:** npm/pnpm run with `--ignore-scripts`; lifecycle scripts blocked in the executor; egress allowlist restricts registries; lockfile changes are visible in the diff and require review.

### 8. Privilege escalation via git hooks
- **Threat:** a worktree contains a malicious `.git/hooks/*` script executed by a git operation.
- **Mitigation:** executor blocks any command touching `.git/hooks`; worktrees are created fresh from `main`; `core.hooksPath` is not set by the runner.

## Residual risks (accepted, Phase 0)
- Docker escape via kernel vulnerability (mitigated, not eliminated, by MicroVM for high-risk tasks).
- LLM jailbreak producing a plausible-but-wrong plan (mitigated by human review + approval gate; not eliminated).
- Operator machine compromise outside the runner (out of scope — operator OS hygiene).
