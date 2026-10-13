# HandyHub — project notes for Claude

RUNI Full-Stack course final project (2026): a Hebrew (RTL) social network for makers / DIY.
Requirements PDF: `~/Desktop/מדעי המחשב רייכמן /שנה ג/סמסטר ב /fullstack course /lectures&notes /finalProject.pdf`
(part 1 = basics, part 2 = core + AWS deploy, part 3 = choose 3 of 6 optional features).
Talk to the user in Hebrew; they work section by section and run `git commit` themselves (give them the commands, short messages).

## Stack & layout
- `backend/` Flask + MySQL (raw SQL via `db.py` helpers `query/execute/commit`), bcrypt, session cookie (`auth.py`).
  Blueprints in `backend/routes/`. Schema in `schema.sql`; `seed.py` is **non-destructive** (adds missing tables/columns via
  `COLUMN_MIGRATIONS`, adds demo data only if missing); `./start.sh --reset` wipes (asks "yes"). `manage.py set-role <user> admin`.
- `frontend/` Vite + React 18 + Tailwind 3 + TipTap. Components converted from a Claude Design export (originals in `design/`).
  Hash routing in `components/App.jsx` (`#/u/<user>`, `#/tag/x`, `#/market`, `#/stores`, `#/store/<id>`, `#/admin`, `#/reset/<token>`).
  API client + adapters in `src/lib/api.js`.
- API on **port 5050** (5001 is taken by another app of the user's); Vite on 5173 proxies `/api` and `/uploads`.
- Run everything: `./start.sh`. Mail: `MAIL_BACKEND=smtp` with Gmail app password in `backend/.env` (works); `console` prints emails.

## Tests (keep ≥ 85% — course requirement)
- Backend: `cd backend && .venv/bin/python -m pytest` → 70 tests, 99%. Uses a separate `<DB_NAME>_test` database; mail forced to `memory`.
- Frontend: `cd frontend && npm run coverage` → 87 tests, 98%. Runs the whole app against an in-memory fake API
  (`src/test/fakeServer.js` — keep it in sync when adding endpoints; `server.fetch.failNext = 'METHOD /path'` simulates one error).

## Status
Done:
- Part 1 (all): auth, profiles, follow, search, time-ago, global/following feed + infinite scroll, rich-text posts + images, DB diagram (`docs/`).
- Part 2: a. password reset by email (Gmail SMTP) · b. likes + comments · e.i–ii roles, reports, admin dashboard, bans · f. tests ≥ 85%.
- Extra (counts toward part 3c): real private messages with unread polling + "new message" toast; marketplace listings
  ("buy/lend" opens a DM with the seller); store reviews (review creates the store). Profile cover/avatar overlap fixed.

Remaining (user's order, ask before starting):
- Part 2 steps 3–6 (deferred by the user): AI layer (provider not chosen yet — ask), auto-correct / suggested posts /
  suggested comments, toxicity check before publishing, 10 autonomous agent accounts with personalities (`users.is_agent`,
  `users.personality` already exist). Follow lecture 8 advice: guardrails, fallbacks, prompt-injection defense, eval set, logging.
- Part 2 step 9: deploy to AWS (EC2 + RDS + S3, Docker; course lab also asks for an AMI) — user said AWS goes last.
- Part 3: choose 3 optional features (likely: responsive design — mostly done; recommendation engine — suggested users done,
  trending needs a 24h window; DMs done; Docker comes with the AWS deploy).
- Still mock data from the design: notifications panel and saved items.

## Gotchas
- The user's MySQL runs as a macOS system service; never print secrets from `backend/.env`.
- iCloud: project was moved out of `~/Desktop` (iCloud evicted venv/node_modules files and Vite kept reloading).
- Tailwind only sees full class names — never build classes like `text-${color}-700`.
