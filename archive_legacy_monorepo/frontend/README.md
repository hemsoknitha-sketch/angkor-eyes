# ANGKOR EYES — Mini Web (Telegram WebApp) 🌐

Mini Web app សម្រាប់ ANGKOR EYES — ភាសាខ្មែរជាចម្បង, English secondary.
React + Vite + TypeScript + Tailwind + @twa-dev/sdk + Socket.IO client.

## ដំណើរការ · Run

```bash
cp .env.example .env   # កំណត់ VITE_BACKEND_URL, VITE_BOT_USERNAME
npm install
npm run dev            # http://localhost:5173
npm run build          # dist/ — deploy ជា static site
npm run preview
```

### Env vars

| Var | Example |
|---|---|
| `VITE_BACKEND_URL` | `http://localhost:3000` (ទទេ = mock/fallback mode) |
| `VITE_BOT_USERNAME` | `angkor_eyes_bot` |

## Telegram WebApp setup 🤖

1. បើក @BotFather → `/newbot` (ឬបូតដែលមានស្រាប់) → `/setdomain` ឬ `/setmenubutton`.
2. កំណត់ Menu Button URL ទៅ URL ដែល deploy frontend (ឧ. `https://app.example.com`).
3. បូតប្រើ `t.me/<bot>?startapp=<param>` ដើម្បីបើក Mini Web ទៅទំព័រជាក់លាក់ (ឧ. `startapp=new-agent`, `startapp=approval:<id>`).
4. Backend ផ្ទៀងផ្ទាត់ `x-telegram-init-data` header (Telegram initData) — មើល `src/lib/api.ts`។

## លក្ខណៈ · Features

- **Sidebar:** Lead Agent, Rooms, Agents + 5 Centers
- **Roster:** Edit / Delete / Clone / Pause agents; **AddAgentForm** no-code (name, project, role, model)
- **TaskTree:** Lead plan → Dev / QA / Reviewer
- **RoomChat:** per-project rooms (my-shop, launch-day), Live Typing, queue (“Advisor waits for QA, then answers”), @mention autocomplete, 👍/👎 feedback, “Retry from here”, FileUpload (presigned S3/R2 via backend)
- **WorktreePanel + DiffViewer:** branch/worktree status, Approve / Not yet / Reject
- **MemoryPanel:** Shared Memory / Rules view/edit/delete
- **AwayToggle + WelcomeBack:** timeline ខណៈពេល away, pending approvals
- **OnboardingWizard:** 3 steps — Connect Repo → Create first Agents → Trial Task
- **5 Centers:** System Control (Runner status + STOP ALL Kill Switch), Git Execution (Branch/Commit/Worktree/Diff/Test/Logs), Security (alerts, permission changes, secret detection, approval history), Usage & Cost (token/cost per agent/day/project, budget limit, charts), Audit & Recovery (search audit, diff, restore checkpoints, retry failed tasks)
- **Shortcuts:** ⌘K command palette, ⌘Enter send
- **Dark Mode** + Noto Sans Khmer (line-height 1.8 សម្រាប់ភាសាខ្មែរ)
- **Mock fallback:** ពេល backend មិនអាចភ្ជាប់បាន UI នៅតែដំណើរការដោយទិន្នន័យ mock — API calls ពិតត្រូវបានព្យាយាមមុនជានិច្ច។
