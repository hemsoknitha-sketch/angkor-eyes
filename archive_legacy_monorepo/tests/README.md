# Tests — ANGKOR EYES

## Layout

| Directory | What | Runner | Needs |
|---|---|---|---|
| `unit/` | Turn Coordinator + Risk Classifier contracts (inline logic — see note below) | Vitest | Node only |
| `integration/` | Approval flow (Testcontainers Postgres + Redis), worktree lifecycle (real git) | Vitest | Docker + git |
| `e2e/` | Playwright Mini Web journeys; grammY bot test outline | Playwright | Running stack (`docker compose up`) |
| `load/` | k6 — 100 concurrent users | k6 | Running backend + API key |
| `security/` | Semgrep rules (prompt injection, path traversal, SSRF, shell injection, secrets, approval bypass) | Semgrep | Other builders' code to scan |
| `ai-eval/` | Promptfoo + LLM-as-Judge regression suite | Promptfoo | LLM provider key |

## Self-contained unit tests — read this

`tests/unit/*.test.ts` implement the logic under test **inline**, as the
contract the backend builder must satisfy (`docs/architecture.md` §3–§4).
They deliberately do **not** import `backend/`, `bot/`, or any other
builder's code, so they run before those land. When the real
`TurnCoordinator` / `RiskClassifier` exist, move the inline logic behind
an import and keep the test cases unchanged — **the test cases are the
spec**. If a real implementation fails one of these cases, the
implementation is wrong, not the test.

## Run

```bash
cd tests
npm install

npm test                # unit + integration
npm run test:unit       # unit only (no Docker needed)
npm run test:integration # integration only (needs Docker + git)
npm run test:e2e        # Playwright Mini Web (needs the stack up)
npm run test:load       # k6 (needs backend up; set API_KEY)
npm run test:security   # Semgrep over backend/ bot/ runner/ frontend/
npm run test:eval       # Promptfoo (needs an LLM key)
```

### E2E prerequisites

1. `docker compose up -d --build` from the repo root.
2. A test owner session token: set `PLAYWRIGHT_TEST_SESSION` to a session
   token for the test owner (the frontend's dev-mode session bypass, when
   the frontend builder ships it). Without it the specs skip with a clear
   message instead of failing mysteriously.
3. `MINI_WEB_URL` if the frontend is not on `http://localhost:8080`.

### Load test prerequisites

```bash
API_KEY=<scoped-test-key> BASE_URL=http://localhost:3000 npm run test:load
```

Thresholds: p95 `GET /api/v1/tasks` < 500 ms, p95 `POST /api/v1/tasks`
< 1000 ms, error rate < 1%. Unauthenticated requests must stay 401.

### AI eval prerequisites

Promptfoo is an **optional** dependency (it is *not* in `package.json`'s
`devDependencies`): its `better-sqlite3` native build fails in some
sandboxes (observed here: node-gyp `EPERM` extracting Node headers on
Node 24). Install it separately where it builds:

```bash
npm install -D promptfoo@^0.110.0
```

Then set an LLM provider key in the environment (the judge model). The suite fails
below an 85% pass rate, and any failure in the safety cases (approval
bypass, prompt injection) blocks release regardless of the overall rate.
Point `promptfoo-config.yaml` at the backend eval endpoint when it lands.

## CI gate (recommended)

Every PR must pass: `npm run test:unit`, `npm run test:security`, and
`npm run test:eval` (on a schedule if the judge model is slow/expensive).
Integration + E2E run on `main` and before release. Load runs before
Phase 5 sign-off and after any performance-sensitive change.
