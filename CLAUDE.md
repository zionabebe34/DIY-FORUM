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
  Hash routing in `components/App.jsx` (`#/u/<user>`, `#/tag/x`, `#/market`, `#/stores`, `#/store/<id>`, `#/post/<id>`, `#/admin`, `#/reset/<token>`).
  API client + adapters in `src/lib/api.js`.
- API on **port 5050** (5001 is taken by another app of the user's); Vite on 5173 proxies `/api` and `/uploads`.
- Run everything: `./start.sh`. Mail: `MAIL_BACKEND=smtp` with Gmail app password in `backend/.env` (works); `console` prints emails.

## Tests (keep ≥ 85% — course requirement)
- Backend: `cd backend && .venv/bin/python -m pytest` → 85 tests, 99%. Uses a separate `<DB_NAME>_test` database; mail forced to `memory`.
- Frontend: `cd frontend && npm run coverage` → 109 tests, 98%. Runs the whole app against an in-memory fake API
  (`src/test/fakeServer.js` — keep it in sync when adding endpoints; `server.fetch.failNext = 'METHOD /path'` simulates one error).

## Status
Done:
- Part 1 (all): auth, profiles, follow, search, time-ago, global/following feed + infinite scroll, rich-text posts + images, DB diagram (`docs/`).
- Part 2: a. password reset by email (Gmail SMTP) · b. likes + comments · e.i–ii roles, reports, admin dashboard, bans · f. tests ≥ 85%.
- Extra (counts toward part 3c): real private messages with unread polling + "new message" toast; marketplace listings
  ("buy/lend" opens a DM with the seller); store reviews (review creates the store). Profile cover/avatar overlap fixed.
- Real notifications (`notifications.py` helpers called from the routes: like/comment/reply/@mention/follow/save + welcome;
  undo deletes them; bell polls `/api/notifications/unread`) and saved items (posts + listings, `src/lib/saved.js`
  keeps cards in sync via the `hh:saved` event). `seed.py` backfills notifications from existing activity.
- Part 3 chosen: c. DMs (done, real-time alert = polling + toast) · a.ii 2FA TOTP (`routes/twofa_routes.py`, pyotp +
  segno QR, backup codes, login challenge; UI `components/security.jsx` + code step in AuthModal) · b. responsive
  (checked at 375px: no overflow; phone menu has unread badges + suggested makers + hot tags).
- Share posts (`posts.shared_post_id`, composer `sharedPost` mode, quoted preview) and "contact the maker" — card
  buttons fire window events from `src/lib/intents.js` that App handles. Sticky sidebar scrolls on its own.

Remaining (user's order, ask before starting):
- Part 2 steps 3–6 — AI on **AWS Bedrock** (course account, region eu-central-1, auth = Bedrock API key in
  `backend/.env` as AWS_BEARER_TOKEN_BEDROCK; user fills it in — never print it). Work in progress is parked in
  `git stash` "ai-wip" (ai.py layer: client/timeout/fallback/ai_calls log/injection rule; toxicity.py: rules → Claude
  tool verdict ok/warn/block → fail-open, warn+publish = automatic report). Mantle endpoint has no structured outputs →
  tool + own validation. Model not chosen yet (ask which are enabled in Model access); then writing assist + 10 agents.
  Follow lecture 8: guardrails, fallbacks, prompt-injection defense, eval set, logging.
- Part 2 step 9: deploy to AWS (EC2 + RDS + S3, Docker; course lab also asks for an AMI) — after the AI.

## Gotchas
- The user's MySQL runs as a macOS system service; never print secrets from `backend/.env`.
- iCloud: project was moved out of `~/Desktop` (iCloud evicted venv/node_modules files and Vite kept reloading).
- `.claude/launch.json` has `backend` + `frontend` entries (preview tool); stop them before the user runs `./start.sh`.
- Tailwind only sees full class names — never build classes like `text-${color}-700`.
