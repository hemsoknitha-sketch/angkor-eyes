# ANGKOR EYES — Telegram Bot 🤖

បូត Telegram សម្រាប់ Lead Agent — ភាសាខ្មែរជាចម្បង, English secondary.
Telegram bot for the Lead Agent — Khmer-first, English secondary.

## ដំណើរការ · Run

```bash
cp .env.example .env   # ប្រសិនបើមាន — បើមិនមាន បង្កើតដោយខ្លួនឯងតាមខាងក្រោម
npm install
npm run dev            # polling (local)
npm run build && npm start
```

### Env vars

| Var | Required | Example |
|---|---|---|
| `BOT_TOKEN` | ✅ | `123456:ABC…` from @BotFather |
| `BACKEND_URL` | ✅ | `http://localhost:3000` |
| `BOT_USERNAME` | ✅ | `angkor_eyes_bot` (no @) |
| `ALLOWED_TELEGRAM_IDS` | ✅ | `123456789,987654321` |
| `WEBHOOK_DOMAIN` | webhook only | `https://bot.example.com` |
| `WEBHOOK_SECRET_TOKEN` | webhook only | random string |
| `PORT` | no | `8080` |

No tokens/keys are hardcoded — everything comes from env.

## ពាក្យបញ្ជា · Commands

- `/start` — ចាប់ផ្តើម / Start
- `/newagent` — បើក Mini Web ដើម្បីបង្កើតភ្នាក់ងារថ្មី / Add agent via Mini Web
- `/away` — Away Mode: ភ្នាក់ងារបន្តធ្វើការ, ការអនុម័តរង់ចាំ
- `/back` — ត្រឡប់មកវិញ + Welcome Back Digest ភ្លាមៗ
- `/schedule` — កាលវិភាគ (ក្នុង Mini Web → System Control Center)
- `/help` — ជំនួយ

## លក្ខណៈ · Features

- **1-on-1 Lead Agent chat:** សារធម្មតាត្រូវបានផ្ញើទៅ Backend (`POST /api/lead/chat`)។ Small talk ឆ្លើយក្នុងបូត។
- **Approvals:** សារជូនដំណឹងមានប៊ូតុង `[Approve] [View Diff in Mini Web] [Not yet] [Reject]`។ ការសម្រេចចិត្តផ្ញើទៅ `POST /api/approvals/decide`។
- **Away Mode:** `/away` / `/back` — `/back` ទាញ Digest ពី `GET /api/away/digest` ភ្លាមៗ។
- **Room summary:** ពេលបន្ទប់/ក្រុមបញ្ចប់កិច្ចការ បូតផ្ញើសង្ខេបខ្លី។
- **Auth:** មានតែ `ALLOWED_TELEGRAM_IDS` ទេដែលប្រើបាន។
- **Idempotency:** update ដែលផ្ញើមកពីរដង (update_id ដដែល) ត្រូវបានទុកចោល។

## Telegram Forum Topics 🧵

បន្ទប់នីមួយៗ (project room) អាចភ្ជាប់ទៅ **Topic មួយ** ក្នុងក្រុម Forum:

1. បង្កើតក្រុម Telegram → Group Settings → បើក **Topics**។
2. បង្កើត Topic មួយក្នុងមួយបន្ទប់ (ឧ. `my-shop`, `launch-day`)។
3. បន្ថែមបូតទៅក្រុម ហើយកត់ត្រា `topic_id` ក្នុងបន្ទប់ (Mini Web → Rooms)។
4. បូតឆ្លើយតែពេលត្រូវបាន @mention ឬ reply ទៅសាររបស់បូត — ដូច្នេះ Topic នីមួយៗមិនរំខានគ្នា។

Each project room can link to one Forum Topic in a group. The bot only replies when @mentioned or replied to, so topics stay independent.
