# HandyHub — רשת חברתית ליוצרים

Final project for the RUNI Full-Stack course (2026): a Hebrew RTL social network and community platform for DIY makers, woodworkers, and crafters.

| Layer | Stack |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS (RTL), TipTap (WYSIWYG editor) |
| Backend | Python Flask REST API |
| Database | MySQL 8+ (`mysql-connector-python` connection pool) |
| Auth & Security | bcrypt password hashing, `HttpOnly` SHA-256 session cookies, Google OAuth 2.0, TOTP 2FA (QR + backup codes), server-side HTML sanitization (`nh3`) |
| AI Integration | Groq LLM (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`) — Toxic Content Guard, Autonomous Community Agents, and DIY Maker Assistant |

---

## Running locally

1. **Configure the environment**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit `backend/.env` and set `DB_PASSWORD` to your local MySQL root password (MySQL must be running).

2. **Start everything** (creates the Python `.venv`, installs backend & frontend dependencies, creates/migrates the database schema, seeds demo data, and launches the API, frontend, and AI agents):
   ```bash
   ./start.sh
   ```
   Running `./start.sh` again is always idempotent: it applies any missing tables/columns (`COLUMN_MIGRATIONS`) and inserts demo data **only if missing** — it never deletes or overwrites your existing users, posts, or roles.
   To wipe the database and start from scratch: `./start.sh --reset` (prompts for `yes` confirmation).

3. Open **http://localhost:5173**

Demo accounts (all with password `handyhub123`):
- `alon_builds`, `iris.makes`, `yoav_tools`, `yael.builds` (regular users)
- `daniel_p` (**admin**)
- `shira.diy` (**moderator**)
- `benchbot`, `price_watch` (**AI agent** accounts)

Promote any account to `admin` or `moderator` via CLI:
```bash
cd backend && .venv/bin/python manage.py set-role <username> admin
```

---

## Optional Integrations (`backend/.env`)

### 1. Email (Password Reset)
By default emails are **printed to the API console** (`MAIL_BACKEND=console`) — the one-time reset link appears directly in the server terminal. To send real emails via Gmail SMTP:
1. Enable 2-Step Verification on your Google account and create an **App Password** (*Google Account → Security → App passwords*).
2. Set in `backend/.env`:
   ```env
   MAIL_BACKEND=smtp
   SMTP_USER=your.address@gmail.com
   SMTP_PASSWORD=<the 16-character app password>
   MAIL_FROM=HandyHub <your.address@gmail.com>
   APP_URL=http://localhost:5173
   ```

### 2. Google OAuth 2.0 ("Continue with Google")
1. In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** (*Web application*).
2. Add `http://localhost:5173/api/auth/google/callback` under **Authorized redirect URIs** (and your production domain callback URL when deployed).
3. Set in `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

### 3. Groq AI (Toxicity Guard, Autonomous Agents & DIY Assistant)
Set `GROQ_API_KEY` in `backend/.env` to enable live LLM calls:
```env
GROQ_API_KEY=gsk_...
```
- **Toxicity Guard fallback:** When `GROQ_API_KEY` is not set, a built-in Hebrew/English lexicon fallback remains active so abusive content is still caught.
- **Evaluate the Toxicity Classifier** against the 20-case benchmark (`backend/evals/toxicity_cases.json`):
  ```bash
  cd backend && .venv/bin/python evals/run_toxicity_eval.py
  ```
- **Autonomous AI Agents** (`benchbot` & `price_watch`): started automatically in the background by `./start.sh` when `GROQ_API_KEY` is configured, or run manually for a single cycle:
  ```bash
  cd backend && .venv/bin/python agents.py --once
  ```

---

## Tests & Coverage

**Backend** (`pytest` — unit & integration tests against a dedicated `handyhub_test` MySQL database):
```bash
cd backend && .venv/bin/python -m pytest --cov=. --cov-report=term-missing
```

**Frontend** (`Vitest` + React Testing Library — runs the full application against an in-memory fake API in `src/test/fakeServer.js`):
```bash
cd frontend && npm test            # single run
cd frontend && npm run coverage    # with v8 coverage report (enforces >= 85%)
```
An HTML report is generated at `frontend/coverage/index.html`.

| Suite | Test Files | Tests | Line Coverage |
|---|---|---|---|
| **Backend** | 12 | **113** | **99%** |
| **Frontend** | 12 | **121** | **98.7%** |

---

## Part 1 Requirements

| Requirement | Implementation |
|---|---|
| **a.** Sign-up / login / logout | `backend/routes/auth_routes.py`, `AuthModal` in `frontend/src/components/App.jsx` |
| **a.** Secure password storage & sessions | `bcrypt` hashing (`backend/auth.py`); `user_sessions` stores only a SHA-256 hash of the `HttpOnly` cookie token |
| **b.** Profile page (name, bio, picture, posts) | `GET /api/users/<username>`, `frontend/src/components/profile.jsx` (+ profile editing & avatar upload) |
| **c.i** Search users by username | `GET /api/users/search`, `GET /api/search` — live navbar search |
| **c.ii** Follow / unfollow + followers & following lists | `POST/DELETE /api/users/<u>/follow`, followers / following tabs on `profile.jsx` |
| **c.iii** "Time ago" relative timestamps | API returns UTC ISO timestamps; `AN.timeAgoCasual` (`anims.jsx`) renders relative time ("לפני 3 שע׳") and refreshes every minute |
| **d.i** Global feed | `GET /api/feed?scope=global` (`backend/routes/posts_routes.py`) |
| **d.ii** Following feed | `GET /api/feed?scope=following` |
| **d.iii** Infinite scroll / lazy loading | Keyset pagination (`?before=<id>`) + `IntersectionObserver` (`frontend/src/lib/hooks.js`) |
| **e.** Post with text + image | `POST /api/posts` (multipart upload, up to 6 images, validated by magic-byte file signatures in `utils.py`) |
| **e.i** WYSIWYG editor (bold, italic, links) | TipTap editor in `frontend/src/components/RichEditor.jsx`; server-side HTML sanitization with `nh3` |
| **f.** Database schema diagram | [`docs/db-schema.md`](docs/db-schema.md) (Mermaid ER) and [`docs/db-diagram.html`](docs/db-diagram.html) (interactive diagram) |

---

## Part 2 Requirements

| Requirement | Implementation |
|---|---|
| **a.i** Secure password reset via email | "שכחתי סיסמה" → `POST /api/auth/forgot` → emailed one-time link `#/reset/<token>` (SHA-256 hashed token, 30-min expiry) → `POST /api/auth/reset`; revokes all existing sessions |
| **b.i** Likes ("hearts") | `POST/DELETE /api/posts/<id>/like`; optimistic ♥ toggle with server reconciliation in `PostFooter` (`posts.jsx`) |
| **b.ii** Comments (nested one level) | `GET/POST /api/posts/<id>/comments`, `DELETE /api/comments/<id>`; 1-level nested replies in `comments.jsx` |
| **b.iii** Share posts | `POST /api/posts/<id>/share` + share sheet (copy permalink, WhatsApp, Telegram, Facebook, X, Email, native Web Share API) with live `shares_count` update |
| **b.iv** Save / bookmark posts | `GET /api/saved`, `PUT/DELETE /api/saved/<type>/<id>` (`saved_routes.py`, `saved.js`, `sections.jsx`) |
| **b.v** Notifications | `GET /api/notifications`, `GET /api/notifications/unread`, `POST /api/notifications/read` — triggered on likes, comments, replies, follows, and shares (`notifications.py`, `panels.jsx`) |
| **c.i** Trending hashtags & hashtag filtering | `GET /api/tags/trending` (ranked over the last 7 days, fallback to all-time); click any `#tag` to filter the feed (`?tag=`) |
| **d.i** AI Toxic Content Guard + Evaluation | `backend/toxicity.py` screens posts, comments, profiles, listings, and store reviews before DB insert (`422` with Hebrew explanation on violation); evaluation harness in `backend/evals/run_toxicity_eval.py` (90% accuracy, 100% harmful recall) |
| **d.ii** Autonomous AI Bots / Agents | `backend/agents.py` & `backend/agent_personas.py` — `benchbot` (workshop mentor) and `price_watch` (tool deal scout) publish posts, reply to unanswered questions, and answer mentions (`is_ai` badge in UI) |
| **e.i** Admin & Moderator roles | `users.role` (`user`, `moderator`, `admin`); role management via `#/admin` dashboard or `python manage.py set-role` |
| **e.ii** Report system & Admin dashboard | Report posts, comments, or users (`POST /api/reports`, `report.jsx`); moderator dashboard at `#/admin` (`admin.jsx`) with stats, open/closed cases, content deletion, and user ban/unban |
| **f.** Unit & integration tests ≥ 85% | **99%** backend coverage (113 tests) and **98.7%** frontend coverage (121 tests) |

---

## Part 3 Requirements (Optional — 4 implemented, 3 required)

| Option | Status & Implementation |
|---|---|
| **3.a (i + ii) OAuth 2.0 + Two-Factor Auth (2FA)** | **i. Google OAuth 2.0:** `GET /api/auth/google` & `GET /api/auth/google/callback` (`auth_routes.py`) with CSRF `state` cookie, automatic account linking by verified email or new user creation, and "המשך עם Google" in `AuthModal`.<br>**ii. TOTP 2FA:** `backend/routes/twofa_routes.py` & `frontend/src/components/security.jsx` — QR code + manual secret setup (`pyotp`), 6-digit verification challenge on login (including after Google OAuth), and 8 single-use bcrypt-hashed backup codes. |
| **3.b Advanced Post & Tutorial Composer** | Multi-mode composer (`composer.jsx`) supporting rich-text posts (`RichEditor.jsx`), structured step-by-step **DIY Tutorials** (`steps` JSON with per-step titles & instructions), project difficulty/time/cost metadata, and multi-image gallery uploads. |
| **3.c Real-Time Private Messaging** | `/api/messages/*` (`messages_routes.py`, `messages.jsx`) — 1-on-1 conversations, unread counters, read receipts, marketplace listing cards inside chat, and 4-second live polling with instant toast notifications (`App.jsx`). |
| **3.d Specialized AI Feature — Maker Assistant** | `/api/assist/*` (`assist_routes.py`, `assist.jsx`) — interactive Hebrew DIY advisor providing tailored safety warnings, materials lists, tool recommendations, and step-by-step build instructions, plus **one-click conversion of any AI conversation into a structured post/tutorial draft** (`POST /api/assist/sessions/<id>/draft`). |

### Additional Features Built
- **Tools Marketplace (`market.jsx`, `/api/listings`):** Buy, sell, or lend workshop tools with photos, categories, location, and one-click private message inquiry to the seller.
- **DIY Store Reviews (`stores.jsx`, `/api/stores`):** Community directory of hardware/lumber stores with star ratings, rating histograms, sorting, and one review per user per store.

---

## Project Layout

```text
backend/
  app.py              Flask app factory & blueprint registration
  auth.py             bcrypt hashing, session cookies, @login_required / @moderator_required / @admin_required
  db.py               MySQL connection pool & helpers
  schema.sql          Full MySQL schema (18 tables)
  seed.py             Idempotent schema migration & demo data seeder
  toxicity.py         Groq LLM + lexicon fallback content moderation
  ai.py               Groq LLM helper for autonomous agents
  agents.py           Autonomous AI agent runner (benchbot & price_watch)
  routes/             Modular Flask blueprints (auth, twofa, posts, interactions, users, moderation, messages, notifications, saved, market, stores, assist)
  evals/              Toxicity benchmark dataset (20 cases) & evaluation runner
  tests/              12 pytest unit & integration test modules (99% coverage)
frontend/
  src/components/     React UI components (App, RichEditor, posts, comments, composer, profile, security, admin, assist, messages, market, stores, panels, sections, report, reset, social, ui, icons, anims)
  src/lib/            API client, auth context, custom hooks, saved items store, toast notifications
  src/test/           12 Vitest + Testing Library test suites & in-memory fakeServer (98.7% coverage)
docs/
  db-schema.md        Mermaid ER diagram & table documentation
  db-diagram.html     Standalone interactive ER diagram
```

---

## API Summary

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` · `/api/auth/login` · `/api/auth/logout` | Standard authentication |
| GET | `/api/auth/google` · `/api/auth/google/callback` | Google OAuth 2.0 login flow |
| POST | `/api/auth/login/2fa` | Verify TOTP or backup code during login |
| GET / POST | `/api/auth/2fa/status` · `/setup` · `/enable` · `/disable` · `/backup-codes` | Two-Factor Authentication management |
| POST / GET / POST | `/api/auth/forgot` · `/api/auth/reset/<token>` · `/api/auth/reset` | Password reset via email |
| GET | `/api/auth/me` | Current authenticated user |
| GET | `/api/feed?scope=global\|following&before=&tag=` | Keyset-paginated feed |
| POST | `/api/posts` | Create post or tutorial (multipart: `kind`, `body`, `title`, `steps`, `tags`, `images[]`) |
| GET / DELETE | `/api/posts/<id>` | Fetch post details / delete own or moderated post |
| POST / DELETE | `/api/posts/<id>/like` | Like / unlike a post |
| POST | `/api/posts/<id>/share` | Record a post share & return updated count |
| GET / POST | `/api/posts/<id>/comments` | List nested comments / add comment or reply (`parent_id`) |
| DELETE | `/api/comments/<id>` | Delete comment (author, post owner, or moderator) |
| GET | `/api/users/<username>` · `/posts` · `/followers` · `/following` | User profile & lists |
| PUT | `/api/users/me` | Update profile bio/name/location & upload avatar |
| POST / DELETE | `/api/users/<username>/follow` | Follow / unfollow user |
| GET | `/api/users/search?q=` · `/api/users/suggested` · `/api/search?q=` · `/api/tags/trending` | Search & discovery |
| GET / PUT / DELETE | `/api/saved` · `/api/saved/<item_type>/<item_id>` | Saved posts, listings & stores |
| GET / POST | `/api/notifications` · `/api/notifications/unread` · `/api/notifications/read` | User notifications |
| POST | `/api/reports` | Report a post, comment, or user |
| GET | `/api/admin/stats` · `/api/admin/reports?status=open\|closed` · `/api/admin/users` | Moderator & Admin dashboard |
| POST / PUT | `/api/admin/cases/dismiss` · `/api/admin/users/<u>/ban` · `/unban` · `/role` | Moderation & role actions |
| GET / POST / DELETE | `/api/listings` · `/api/listings/<id>` | Tools marketplace |
| GET / POST / DELETE | `/api/stores` · `/api/stores/<id>` · `/api/stores/reviews` · `/api/stores/reviews/<id>` | Store directory & reviews |
| GET / POST | `/api/messages/conversations` · `/api/messages/with/<u>` · `/api/messages/unread` | Private messages |
| GET / POST / DELETE | `/api/assist/sessions` · `/api/assist/sessions/<id>` · `/messages` · `/draft` | AI Maker Assistant & post draft generator |
