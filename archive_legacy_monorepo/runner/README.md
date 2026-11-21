# ANGKOR EYES Runner — Local Runner / អ្នករត់ក្នុងម៉ាស៊ីនមូលដ្ឋាន

> **English below — ខ្មែរខាងលើ / English below**

## ខ្មែរ — តើវាជាអ្វី?

Runner គឺជា daemon ដែលរត់នៅលើម៉ាស៊ីនរបស់អ្នក (កុំព្យូទ័រ ឬ VPS)។ វាទទួល task ពី backend តាមរយៈ **WSS (WebSocket សុវត្ថិភាព) ដែលចេញពី runner ទៅ backend តែប៉ុណ្ណោះ — វាមិនបើក port ណាមួយឡើយ**។

- បង្កើត Git worktree ដាច់ដោយឡែកសម្រាប់ task នីមួយៗ
- រត់ test / lint ក្នុង Docker sandbox (មិនមែន root, មានដែនកំណត់ CPU/RAM)
- មិន push ទៅ main ដោយគ្មាន approval ពីមនុស្សឡើយ

## English — What is it?

The runner is a daemon on your machine (laptop or VPS). It receives tasks from the backend over **outbound-only WSS — it opens NO listening port**.

- One isolated Git worktree per task
- Tests/lint run inside a Docker sandbox (non-root, CPU/RAM limited)
- Never pushes to main without a human approval

## Install / ដំឡើង

```bash
cd runner
npm install
npm run build
```

Requirements: Node.js ≥ 20, Git, Docker (for the sandbox).

## Run / រត់

```bash
export RUNNER_TOKEN="<token from backend — never commit it>"
export BACKEND_WSS_URL="wss://backend.example.com/runner"
export REPO_PATH="/path/to/your/repo"
npm start
# or: node dist/index.js --help
```

### Reaching the backend — Cloudflare Tunnel / Tailscale

Do **not** expose the backend publicly. Use one of:

- **Cloudflare Tunnel:** `BACKEND_WSS_URL=wss://runner.<your-domain>/runner`
- **Tailscale:** `BACKEND_WSS_URL=wss://<backend-tailscale-hostname>:8443/runner`

## Docker (VPS)

```bash
docker build -t angkor-runner .
docker run --rm \
  -e RUNNER_TOKEN="$RUNNER_TOKEN" \
  -e BACKEND_WSS_URL="$BACKEND_WSS_URL" \
  -e REPO_PATH=/repos/my-project \
  -v /srv/repos:/repos -v /srv/worktrees:/worktrees \
  angkor-runner
```

> ⚠️ Never mount `/var/run/docker.sock` into the runner. The sandbox must not reach the host Docker daemon.

## Safety rules / ច្បាប់សុវត្ថិភាព

| Rule | Detail |
|---|---|
| No open port | Outbound WSS only |
| Allowlist | `git`, `npm test`, `pnpm test`, `pytest`, lint only |
| Blocked | `rm -rf`, shell chaining (`&&`, `\|`, `` ` ``, `$(...)`), symlinks / path traversal, git hooks, npm lifecycle scripts |
| Risky actions | Require approved `approval_id` + `action_hash` from the backend Approval Gate; re-verified (commit SHA + hash) before push |
| Secrets | Never shown to agents; injected only as env vars when needed |
| Heartbeat / Lease | 30s heartbeat, 90s lease timeout — stale lease = stop claiming |
| Backoff | Exponential reconnect backoff 1s → 60s cap |
| Checkpoint / Resume | Checkpoints in `.angkor-eyes/checkpoints/`; resumed on restart |

## Files

| File | Purpose |
|---|---|
| `src/index.ts` | CLI entry |
| `src/runner.ts` | Heartbeat, lease, polling/claim, checkpoint/resume, backoff, cancellation |
| `src/worktree.ts` | Git Worktree Manager |
| `src/executor.ts` | Sandboxed Tool Executor + allowlist |
| `src/diff.ts` | Diff Generator |
| `src/git-push.ts` | Push Controller (approval re-verification) |
| `src/rollback.ts` | Rollback / Undo |
| `src/merge.ts` | Merge Coordinator client |
| `src/sandbox.ts` | Docker sandbox |
| `src/secrets.ts` | Secrets Vault client |
| `src/redaction.ts` | PII / secret redaction |
| `src/audit.ts` | Local audit log (`logs/audit.jsonl`) |

See `../security/` for the policy, threat model, and schemas this runner enforces.
