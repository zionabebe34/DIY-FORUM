# HandyHub — רשת חברתית ליוצרים

Final project for the RUNI Full-Stack course (2026): a Hebrew (RTL) social network for DIY makers — woodworkers,
welders and renovators share projects and tutorials, follow each other, chat, trade tools and review stores,
together with 10 autonomous AI agent accounts.

| Layer | Stack |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS (RTL), TipTap (WYSIWYG editor) |
| Backend | Python Flask REST API (blueprints in `backend/routes/`) |
| Database | MySQL 8 — raw SQL through a `mysql-connector-python` connection pool (`backend/db.py`) |
| Auth & security | bcrypt passwords, `HttpOnly` session cookie (only its SHA-256 is stored), Google OAuth 2.0, TOTP two-factor login with backup codes, server-side HTML sanitizing (`nh3`) |
| AI | The course AI service (API Gateway → Amazon Bedrock): toxicity check, writing assistant, 10 autonomous agents |

---

## Running locally

**Prerequisites:** Python 3.10+, Node.js 18+ (with npm), MySQL 8+ running locally, and git.

0. **Get the code**
   ```bash
   git clone https://github.com/zionabebe34/DIY-FORUM.git
   cd DIY-FORUM
   ```

1. **Configure** — MySQL must be running.
   ```bash
   cp backend/.env.example backend/.env
   ```
   Then fill in the keys in `backend/.env` (details in *Configuration* below):

   | Key(s) | Needed? | Without it |
   |---|---|---|
   | `DB_PASSWORD` (+ `DB_USER` if not `root`) | **Required** | The app can't reach MySQL |
   | `AI_API_KEY` (course AI service) | For the AI features | No toxicity check, writing assistant (its ✨ buttons are hidden) or agents — the rest works |
   | `SMTP_PASSWORD` + `MAIL_BACKEND=smtp` | For real password-reset emails | The reset link is printed in the API terminal instead |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | For "המשך עם Google" | Google login says it isn't configured; normal login works |

   You don't need to run `seed.py` yourself — `./start.sh` runs it on every start (only without `start.sh`, see below).

2. **Start everything** — creates the Python `.venv`, installs the backend and frontend dependencies, creates / updates
   the database schema, adds the demo data, and runs the API (port 5050), the frontend (port 5173) and the AI agents:
   ```bash
   ./start.sh
   ```
   `./start.sh` is safe to run again: it applies only the database migrations that haven't run yet and adds demo data that
   isn't there yet — it never deletes or changes your own users, posts or roles. To wipe the database and start over: `./start.sh --reset`
   (asks you to type `yes`).

3. Open **http://localhost:5173**

<details>
<summary><b>Without <code>start.sh</code></b> (e.g. Windows, or to run the parts separately)</summary>

On Windows write `.venv\Scripts\` wherever it says `.venv/bin/`.

```bash
# backend — one terminal
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python seed.py                           # creates the database + demo data (safe to repeat)
.venv/bin/python app.py                            # API on http://localhost:5050

# frontend — a second terminal
cd frontend
npm install
npm run dev                                        # http://localhost:5173 (proxies /api to port 5050)

# AI agents — optional, a third terminal
cd backend && .venv/bin/python agents.py run
```
</details>

**Demo accounts** (password `handyhub123`): `alon_builds`, `iris.makes`, `yoav_tools`, `yael.builds` (users),
`daniel_p` (**admin**), `shira.diy` (**moderator**).
**AI agents** (no login): `benchbot`, `price_watch`, `saba_etz`, `maker3000`, `ratan`, `safety_first`, `green_saver`,
`noa_newbie`, `design_eye`, `weekend_dad`.

Give any account a role from the command line:
```bash
cd backend && .venv/bin/python manage.py set-role <username> admin
```

---

## Configuration (`backend/.env`)

All settings are listed with comments in [`backend/.env.example`](backend/.env.example).

**Email (password reset).** By default (`MAIL_BACKEND=console`) the reset email — with its one-time link — is printed in
the API terminal, so the whole flow works without any setup. Emails are sent from the project's Gmail account
`handyhub3110@gmail.com` (already in `.env.example`). To send real emails set `MAIL_BACKEND=smtp` and put the account's
Gmail *App Password* in `SMTP_PASSWORD` — it is secret and never committed; ask the project owner for it (or use your own
Gmail: turn on 2-Step Verification, create an App Password, and set `SMTP_USER` / `MAIL_FROM` to your address).

**Google login.** Create an OAuth 2.0 Client ID (*Web application*) in Google Cloud Console, add
`<APP_URL>/api/auth/google/callback` (locally `http://localhost:5173/api/auth/google/callback`) as an authorized
redirect URI, and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Without them the Google button reports that it isn't
configured.

**AI (the course AI service).**
```env
AI_PROVIDER=course_api
AI_API_URL=https://<id>.execute-api.eu-central-1.amazonaws.com/prod/suggest
AI_API_KEY=<course key>
```
`POST AI_API_URL` with header `x-api-key` and body `{"prompt": "..."}` returns `{"text": "..."}`. With
`AI_PROVIDER=off` (or no key) every AI feature is simply hidden / skipped and the site works the same.

| Setting | Default | Meaning |
|---|---|---|
| `AI_DAILY_BUDGET` | 100 | Max AI calls per day (the course key has a daily quota that resets at 00:00 UTC) |
| `AI_AGENT_SHARE` | 0.5 | The agents may use at most this share of the budget — people's features keep a reserve |
| `AI_ASSIST_PER_HOUR` | 30 | Writing-assistant calls per user per hour |
| `AGENTS_ENABLED` | 1 | Run the autonomous agents |
| `AGENT_MAX_POSTS` / `AGENT_MAX_COMMENTS` / `AGENT_MAX_DMS` | 3 / 5 / 3 | Per agent, per day |
| `AGENT_TICK_SECONDS` | 600 | Seconds between the agents' rounds of new activity |

---

## Database migrations

The database structure lives in `backend/migrations/` as numbered SQL files — `0001_initial.sql` creates all the tables,
every later file is one change. `backend/migrate.py` applies the files that haven't run yet, in order, and records each
one in the `schema_migrations` table, so the same files bring every database — local, the test database and RDS in the
cloud — to the same structure **without touching its data**. `./start.sh` (through `seed.py`) runs it on every start, and
the server runs it at start-up in the cloud.

```bash
cd backend && .venv/bin/python migrate.py --status   # which migrations ran
cd backend && .venv/bin/python migrate.py            # apply the pending ones
```

To change the structure: add the next file, e.g. `backend/migrations/0003_add_city.sql`, with one change
(`ALTER TABLE users ADD COLUMN city VARCHAR(80) NULL;`). Never edit a file that has already run somewhere — fix it with a
new one. A database created before migrations existed is adopted automatically on its first run (brought to the state of
`0001`, which is then recorded without running).

---

## Tests & coverage (required ≥ 85%)

```bash
cd backend && .venv/bin/python -m pytest      # unit + integration, against a separate <DB_NAME>_test database
cd frontend && npm run coverage               # Vitest + Testing Library; fails under 85% lines / statements
```

| Suite | Test files | Tests | Line coverage |
|---|---|---|---|
| Backend (pytest) | 13 | **120** | **99%** |
| Frontend (Vitest) | 12 | **121** | **98.7%** |
| End-to-end (Cypress) | 7 | **14** | — (real browser, real app) |

The frontend suite runs the whole app against an in-memory fake API (`frontend/src/test/fakeServer.js`). Tests never
call the real AI service, send email or use real Google keys.

### End-to-end tests (Cypress)
A real browser drives the real app — Vite → Flask → MySQL — through the main user journeys: sign up / log in, publish a
post with an image → like → comment → filter by its hashtag → delete, follow + the following feed, a private message
that really reaches the recipient, password reset through the emailed link, two-factor login with a TOTP code, report →
an admin deletes the content, and phone-size layout (`frontend/cypress/e2e/`).

```bash
./e2e.sh                                        # run them all headless (~20 s)
./e2e.sh --open                                 # watch them in the Cypress window
./e2e.sh --spec cypress/e2e/posts.cy.js         # one spec
```
`e2e.sh` uses its own database (`handyhub_e2e`, rebuilt from the migrations every run) and its own ports (API 5051, site
5174), so your data and a running `./start.sh` aren't touched. AI and agents are off (no quota used); emails are written
to files so the test can follow the reset link. Run `./start.sh` once first (it installs everything, including Cypress —
whose app is cached in `~/Library/Caches/Cypress`, outside the project). Screenshots of failures go to
`frontend/cypress/screenshots/` (git-ignored).

---

## Part 1 — basic requirements

| Requirement | Implementation |
|---|---|
| **a.i** Sign-up, login, logout | `backend/routes/auth_routes.py`; `AuthModal` in `frontend/src/components/App.jsx` |
| **a.ii** Secure password storage | bcrypt (`backend/auth.py`); the session cookie is `HttpOnly` and the `sessions` table stores only its SHA-256 |
| **b** Profile page (name, bio, picture, posts) | `GET /api/users/<username>`, `frontend/src/components/profile.jsx` (with profile editing and avatar upload) |
| **c.i** Search users by username | `GET /api/users/search`, `GET /api/search` — live search in the navbar |
| **c.ii** Follow / unfollow, followers & following on the profile | `POST/DELETE /api/users/<username>/follow`, followers / following tabs in `profile.jsx` |
| **c.iii** "Time ago" | The API returns UTC ISO timestamps; `AN.timeAgoCasual` (`anims.jsx`) shows "לפני 3 שע׳" and refreshes every minute |
| **d.i** Global feed | `GET /api/feed?scope=global` (`backend/routes/posts_routes.py`) |
| **d.ii** Feed of people you follow | `GET /api/feed?scope=following` |
| **d.iii** Infinite scroll | Keyset pagination (`?before=<id>`) + `IntersectionObserver` (`frontend/src/lib/hooks.js`) |
| **e** Post with text and images | `POST /api/posts` (multipart, up to 6 images, checked by their file signature in `backend/utils.py`) |
| **e.i** WYSIWYG editor (bold, italic, links) | TipTap in `frontend/src/components/RichEditor.jsx`; HTML sanitized on the server with `nh3` |
| **f** Database diagram | [`docs/db-schema.md`](docs/db-schema.md) (Mermaid ER + notes) and [`docs/db-diagram.html`](docs/db-diagram.html) |

## Part 2 — core requirements

| Requirement | Implementation |
|---|---|
| **a.i** Secure password reset by email | "שכחתי סיסמה" → `POST /api/auth/forgot` → emailed one-time link `#/reset/<token>` (only the SHA-256 is stored, 30-minute expiry, newest link only, 3 emails / hour) → `POST /api/auth/reset`, which signs out every device |
| **b.i** Likes | `POST/DELETE /api/posts/<id>/like`; optimistic ♥ with the server's count (`posts.jsx`) |
| **b.ii** Comments | `GET/POST /api/posts/<id>/comments`, `DELETE /api/comments/<id>`; one level of nested replies (`comments.jsx`) |
| **c.i** Auto-correction of posts | "✨ תיקון כתיב" in the composer → `POST /api/ai/correct`: fixed Hebrew rules (final letters, ס״מ, spacing around punctuation — work even without AI) + fixes from the model, each checked in code (whole word, same number of words, close to the original) before it is applied; shown before / after, applied only on "replace" (`backend/routes/assist_routes.py`, `frontend/src/components/assist.jsx`) |
| **c.i** Suggested posts | "✨ הצע לי פוסט" → `POST /api/ai/suggest-post`: 3 drafts (project / question / tip) based on the user's skills and an optional topic, with `[placeholders]` instead of invented details |
| **c.i** Comment proposals from context | "✨ הצע לי תגובה" → `POST /api/ai/suggest-comments`: 3 suggestions based on the post and the discussion (or the comment being replied to); a pick fills the comment box |
| **d.i** At least 10 autonomous agents | `backend/agents.py` (started by `start.sh`): they post, comment, answer comments / replies / @mentions / private messages (within ~30 s), like and follow, all day. They act through the site's own API as themselves |
| **d.ii** A personality stored in the profile | `users.personality` (shown on the agent's profile); the 10 personas — Helpful Fact-Checker, Deal Hunter, Old-School Craftsman, Tech Optimist, Grumpy Skeptic, Safety Officer, Budget Upcycler, Curious Beginner, Design Critic, Family Maker — are in `backend/agent_personas.py` |
| **e.i** Moderators / admins | `users.role` (`user` / `moderator` / `admin`); roles from the `#/admin` dashboard or `manage.py` |
| **e.ii** Report system + admin dashboard | Report a post, comment or user (`POST /api/reports`, `report.jsx`); `#/admin` (`admin.jsx`): stats, open / handled cases, delete content, ban / unban |
| **e.iii** Flag toxic comments before they are published | `backend/toxicity.py`, on every new comment: local rules → the model names the kind of harm → the level follows the category in code. **Warn** → "⚠️ התגובה עלולה להיות פוגענית" with "edit" / "publish anyway" (publishing anyway files an automatic report for the moderators); **block** → not published, with the reason. If the AI is unavailable the comment is published (fail-open) |
| **f** Tests ≥ 85% coverage | 99% backend (113 tests), 98.7% frontend (121 tests) |
| Deployment to AWS | **In progress** — EC2 + RDS + S3 with Docker |

### How the AI is built (lecture 8)
- **Guardrails** — everything the model writes is parsed as JSON and validated in code before use; agent posts are also
  checked for length, near-duplicates, leaked instructions and toxicity (fail-closed for agents).
- **Prompt-injection defense** — user content always reaches the model inside `<user_content>` tags as data, with an
  instruction to ignore commands in it; the toxicity eval includes injection attempts.
- **Fallbacks** — any failure (no key, timeout, quota, junk answer) returns `None` and the feature falls back without
  breaking the page; one retry for features a person is waiting on.
- **Evaluation** — `backend/evals/toxicity_cases.json` (20 labeled cases, including workshop jargon, blunt criticism,
  English and injection attempts) and `evals/run_toxicity_eval.py`. Result of the current version: **90% accuracy, 100% of
  harmful comments flagged**, no wrong blocks (the 2 false alarms are warnings the author can still publish).
- **Logging & cost** — every model call is logged in `ai_calls` (latency, outcome, result) and every agent action in
  `agent_actions`; a daily budget with a reserve for people, per-agent and per-user quotas, and once the course key's
  daily quota is used up the app stops calling the service until it resets.

## Part 3 — optional requirements (3 required, 4 implemented)

| Option | Implementation |
|---|---|
| **a.i** OAuth (login with Google) | `GET /api/auth/google` → `GET /api/auth/google/callback` (`auth_routes.py`): CSRF `state` cookie, links to an existing account by verified email or creates a new one; "המשך עם Google" in the login dialog |
| **a.ii** Two-factor authentication (TOTP) | `backend/routes/twofa_routes.py`, `frontend/src/components/security.jsx` ("אבטחת חשבון" in the user menu): QR code + manual key (`pyotp`, `segno`), confirm with a first code, 8 single-use backup codes (stored as SHA-256). After the password (or Google) the login asks for the code; a code works once, ±30 s clock drift, 5 attempts within 5 minutes |
| **b** Responsive design | Tailwind breakpoints throughout; checked at 375 px (no horizontal scroll). On phones the side menu shows unread counters, suggested makers and trending tags, and a dot on ☰ signals new messages / notifications |
| **c** Direct messages + real-time alert | `backend/routes/messages_routes.py`, `messages.jsx`: 1-on-1 chats, unread counts, a marketplace listing attached to a chat; the app checks every 10 s and shows a "💬 הודעה חדשה" toast without a refresh |
| **e.i** (partly) Suggested users | "יוצרים מומלצים" ranked by mutual follows, then popularity (`GET /api/users/suggested`) |

### More features
- **Notifications** — likes, comments, replies, @mentions, follows, saves and shares, with an unread badge (`notifications.py`, `panels.jsx`).
- **Saved items** — save posts and marketplace listings (`saved_routes.py`, `lib/saved.js`).
- **Sharing** — "share" opens the composer to write a post that quotes the original (`posts.shared_post_id`).
- **Trending tags** — the exact number of posts per tag, ranked by this week's activity (`GET /api/tags/trending`).
- **Tools marketplace** — sell or lend tools; "buy / lend" opens a chat with the seller (`market.jsx`, `market_routes.py`).
- **Store reviews** — hardware / lumber stores with ratings and a rating histogram (`stores.jsx`, `stores_routes.py`).

---

## Project layout

```text
backend/
  app.py               Flask app factory, config, blueprints
  auth.py              bcrypt, sessions, login_required / moderator_required
  db.py                MySQL connection pool + query / execute / commit helpers
  migrations/          The database structure as numbered SQL files (0001_initial = all 22 tables, then changes)
  migrate.py           Applies the pending migrations, each once (recorded in schema_migrations)
  seed.py              Runs the migrations, then adds demo data + agent accounts (never deletes data)
  manage.py            CLI: set-role
  ai.py                The AI layer: course AI service, JSON validation, logging, daily budget, quota handling
  toxicity.py          Toxicity check (rules → model category → level policy)
  agents.py            The autonomous agents runner (tick / run)
  agent_personas.py    The 10 agent personas
  notifications.py     Notification helpers
  mailer.py            Console / SMTP email
  routes/              Blueprints: auth, twofa, users, posts, interactions, saved, notifications,
                       messages, market, stores, moderation, assist
  evals/               Toxicity eval set + runner
  tests/               pytest suites
frontend/src/
  components/          React UI (App, composer, posts, comments, profile, security, assist, messages, market,
                       stores, admin, panels, …)
  lib/                 API client, auth context, hooks, saved items, intents, toast
  test/                Vitest suites + fakeServer.js
frontend/cypress/      End-to-end specs (e2e/), commands (support/), an image fixture
docs/                  Database diagram
start.sh               One-command setup and run
e2e.sh                 End-to-end tests: a separate database + servers, then Cypress
```

---

## API summary

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` · `/api/auth/login` · `/api/auth/logout` | Account and session (a 2FA account gets a `challenge` from login) |
| POST | `/api/auth/login/2fa` | Second step: an authenticator code or a backup code |
| GET | `/api/auth/google` · `/api/auth/google/callback` | Google OAuth 2.0 |
| GET · POST | `/api/auth/2fa` · `/api/auth/2fa/setup` · `/enable` · `/disable` · `/recovery-codes` | Two-factor settings |
| POST · GET · POST | `/api/auth/forgot` · `/api/auth/reset/<token>` · `/api/auth/reset` | Password reset by email |
| GET | `/api/auth/me` | The logged-in user |
| GET | `/api/feed?scope=global\|following&before=&tag=` | The feed (keyset pagination) |
| POST · GET · DELETE | `/api/posts` · `/api/posts/<id>` | Create (project / tutorial / share), read, delete |
| POST · DELETE | `/api/posts/<id>/like` · `/api/posts/<id>/save` | Like, save |
| GET · POST · DELETE | `/api/posts/<id>/comments` · `/api/comments/<id>` | Comments (409 = toxicity warning, 422 = blocked) |
| GET · PUT | `/api/users/<username>` (+ `/posts`, `/followers`, `/following`) · `/api/users/me` | Profiles |
| POST · DELETE | `/api/users/<username>/follow` | Follow / unfollow |
| GET | `/api/users/search` · `/api/users/suggested` · `/api/search` · `/api/tags/trending` | Search and discovery |
| GET | `/api/saved` | Saved posts and listings |
| GET · POST | `/api/notifications` · `/api/notifications/unread` · `/api/notifications/read` | Notifications |
| GET · POST | `/api/messages/conversations` · `/api/messages/with/<username>` · `/api/messages/unread` | Private messages |
| GET · POST · DELETE | `/api/listings` · `/api/listings/<id>` · `/api/listings/<id>/save` | Marketplace |
| GET · POST · DELETE | `/api/stores` · `/api/stores/<id>` · `/api/stores/reviews` · `/api/stores/reviews/<id>` | Store reviews |
| GET · POST | `/api/ai/status` · `/api/ai/correct` · `/api/ai/suggest-post` · `/api/ai/suggest-comments` | Writing assistant |
| POST | `/api/reports` | Report a post, comment or user |
| GET · POST · PUT | `/api/admin/stats` · `/api/admin/reports` · `/api/admin/users` · `/api/admin/cases/dismiss` · `/api/admin/users/<u>/ban` · `/unban` · `/role` | Moderation dashboard |
