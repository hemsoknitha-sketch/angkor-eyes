# ANGKOR EYES — ដំឡើងលើ Windows (E:\ANGKOR EYES)

> សម្រាប់កុំព្យូទ័រផ្ទាល់ខ្លួនរបស់ Sinath។ នេះជា smoke test ក្នុងស្រុក — មិនមែន production ទេ។

## តម្រូវការមុនដំឡើង

1. **Docker Desktop for Windows** — https://www.docker.com/products/docker-desktop/
   - ពេលដំឡើង ជ្រើស **Use WSL 2 instead of Hyper-V**
   - ដំឡើងរួច **Restart កុំព្យូទ័រ** រួចបើក Docker Desktop រង់ចាំរហូតដល់ឃើញ `Engine running` (ខាងក្រោមឆ្វេង)
2. **Node.js LTS (20+)** — https://nodejs.org/ (ជ្រើស LTS)
3. **Git for Windows** — https://git-scm.com/download/win
4. ទំហំទំនេរនៅ Drive E យ៉ាងហោច 5 GB

ពិនិត្យក្នុង PowerShell៖
```powershell
node -v; npm -v; git --version; docker --version; docker compose version
```

## ជំហានដំឡើង

### ១. ដាក់ឯកសារ
- Download zip ដែល Muse ផ្តល់ឲ្យ
- Extract ទៅ **`E:\ANGKOR EYES`** ឲ្យបានត្រឹមត្រូវ — ត្រូវឃើញ `E:\ANGKOR EYES\docker-compose.yml`, `E:\ANGKOR EYES\install-windows.bat`

### ២. បំពេញ `.env` (សំខាន់បំផុត — កុំផ្ញើ Token ក្នុងឆាត)
```powershell
cd E:\ANGKOR EYES
copy .env.example .env
notepad .env
```
បំពេញតែ 4 មុខនេះសិន៖

| ក្នុង `.env` | យកពីណា |
|---|---|
| `TELEGRAM_BOT_TOKEN=` | Telegram → `@BotFather` → `/newbot` |
| `ALLOWED_TELEGRAM_IDS=` | Telegram → `@userinfobot` → លេខ ID របស់អ្នក |
| LLM មួយ — `GEMINI_API_KEY=` | Google AI Studio → https://aistudio.google.com/apikey → Create API key។ ដាក់ក្នុង `.env` ជា `GEMINI_API_KEY=...` និង `LLM_PROVIDER=gemini`។ ម៉ូដែលលំនាំដើម៖ លឿន `gemini-2.5-flash` (routing/memory/summary), ខ្លាំង `gemini-2.5-pro` (Dev/Review/QA) |
| `RUNNER_REPO_PATH=` | ផ្លូវ repo ដែល Runner នឹងធ្វើការ ឧ. `E:\my-shop` — បើមិនទាន់មាន repo ទុកចោលសិនសម្រាប់ smoke test |

ពាក្យសម្ងាត់ `POSTGRES_PASSWORD` ប្តូរឲ្យខ្លាំង។ `.env` ត្រូវបាន gitignore រួចហើយ — កុំ commit, កុំ screenshot ដែលមាន token។

### ៣. ដំណើរការដំឡើង
- ចុចពីរដងលើ **`install-windows.bat`** នៅ `E:\ANGKOR EYES`
- ឬក្នុង PowerShell (Admin)៖
```powershell
cd E:\ANGKOR EYES
.\install-windows.bat
```
វានឹង៖ ពិនិត្យ Node/Git/Docker → បង្កើត `.env` បើមិនទាន់មាន → `npm install` → `docker compose up -d --build`

### ៤. ពិនិត្យ
- បើក browser៖ http://localhost:3000/health — ត្រូវឃើញ `ok` / status 200
- បើក Telegram ជជែកជាមួយ Bot របស់អ្នក → `/start`
- បើមានបញ្ហា៖
```powershell
cd E:\ANGKOR EYES
docker compose ps
docker compose logs -f backend bot
```

### ៥. បញ្ឈប់ / ចាប់ផ្តើមវិញ
```powershell
docker compose down        # បញ្ឈប់
docker compose up -d       # ចាប់ផ្តើមវិញ
```

## Runner (សម្រាប់ធ្វើកូដពិត — ធ្វើក្រោយ smoke test)
Runner ត្រូវការ repo ពិត និង `RUNNER_SHARED_SECRET`។ កុំបើកវានៅ smoke test ដំបូង។ ពេលរួចរាល់៖
```powershell
docker compose --profile runner up -d
```

## ដឹងមុន
- វាមិនទាន់បានតេស្តផ្ទាល់ជាមួយ Postgres/Redis និង LLM ពិតទេ។
- Frontend Branching/Regenerate មិនទាន់ភ្ជាប់ពេញលេញ, Runner មិនទាន់មាន E2E test។
- Timeline ពេញលេញប្រហែល 18 សប្តាហ៍ មិនមែន 8 ទេ។
