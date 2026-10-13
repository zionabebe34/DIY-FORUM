# HandyHub — רשת חברתית ליוצרים

Final project for the RUNI Full-Stack course (2026): a social network for makers / DIY people.

| Layer | Stack |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, TipTap (WYSIWYG editor) — design from Claude Design (`design/`) |
| Backend | Python Flask REST API |
| Database | MySQL 8+ |
| Auth | bcrypt password hashing + `HttpOnly` session cookie |

## Running locally

1. **Configure the database connection**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit `backend/.env` and set `DB_PASSWORD` to your local MySQL root password (MySQL must be running).

2. **Start everything** (creates the venv, installs deps, creates the DB + demo data, runs API and frontend):
   ```bash
   ./start.sh --seed
   ```
   Later runs: `./start.sh` (keeps your data).

3. Open **http://localhost:5173**

Demo accounts (all with password `handyhub123`): `alon_builds`, `iris.makes`, `daniel_p` (**admin**), `shira.diy` (**moderator**), `yoav_tools`, `yael.builds`, and two AI-agent accounts `benchbot`, `price_watch`.

Make any account an admin (e.g. on a database created before roles existed):
```bash
cd backend && .venv/bin/python manage.py set-role <username> admin
```

### Email (password reset)

By default emails are **printed to the API console** (`MAIL_BACKEND=console`) — the reset link shows up in the terminal running the server. To send real email through Gmail:

1. Turn on 2-Step Verification for the Google account, then create an **App Password** (Google Account → Security → App passwords).
2. In `backend/.env` set:
   ```
   MAIL_BACKEND=smtp
   SMTP_USER=your.address@gmail.com
   SMTP_PASSWORD=<the 16-character app password>
   MAIL_FROM=HandyHub <your.address@gmail.com>
   APP_URL=http://localhost:5173
   ```
   (`APP_URL` is the site address used inside the emailed link — change it to the real domain when deployed.)

### Tests

**Backend** (pytest, integration tests against a separate `handyhub_test` MySQL database):
```bash
cd backend && .venv/bin/python -m pytest
```

**Frontend** (Vitest + React Testing Library). The whole app runs against an in-memory fake API (`src/test/fakeServer.js`), so no server or database is needed:
```bash
cd frontend && npm test            # run once
cd frontend && npm run coverage    # with a coverage report (fails below 85%)
```
An HTML report is written to `frontend/coverage/index.html`.

| | Tests | Coverage (lines) |
|---|---|---|
| Backend | 61 | 99% |
| Frontend | 81 | 97% |

## Part 1 requirements → where they live

| Requirement | Implementation |
|---|---|
| a. Sign-up / login / logout | `backend/routes/auth_routes.py`, `AuthModal` in `frontend/src/components/App.jsx` |
| a. Secure password storage | bcrypt (`backend/auth.py`); sessions store only a SHA-256 of the cookie token |
| b. Profile page (name, bio, picture, posts) | `GET /api/users/<username>`, `frontend/src/components/profile.jsx` (+ edit profile & avatar upload) |
| c.i Search users by username | `GET /api/users/search`, `GET /api/search` — navbar search |
| c.ii Follow / unfollow + followers & following on profile | `POST/DELETE /api/users/<u>/follow`, followers / following tabs on the profile |
| c.iii "time ago" timestamps | API returns UTC ISO times; `AN.timeAgoCasual` renders "לפני 3 שע׳" and refreshes every minute |
| d.i Global feed | `GET /api/feed?scope=global` |
| d.ii Following feed | `GET /api/feed?scope=following` |
| d.iii Infinite scroll / lazy loading | keyset pagination (`?before=<id>`) + `IntersectionObserver` (`frontend/src/lib/hooks.js`) |
| e. Post with text + image | `POST /api/posts` (multipart, up to 6 images, validated by file signature) |
| e.i WYSIWYG editor (bold, italic, links) | `frontend/src/components/RichEditor.jsx`; HTML sanitized server-side with `nh3` |
| f. Database schema diagram | [`docs/db-schema.md`](docs/db-schema.md) / [`docs/db-diagram.html`](docs/db-diagram.html) |

## Part 2 progress

| Requirement | Status / implementation |
|---|---|
| a.i Secure password reset (email) | ✅ "שכחתי סיסמה" → `POST /api/auth/forgot` → emailed one-time link `#/reset/<token>` (30 min) → `POST /api/auth/reset`; all sessions revoked |
| b.i Likes ("hearts") | ✅ `POST/DELETE /api/posts/<id>/like`; optimistic ♥ in `PostFooter` (`posts.jsx`) |
| b.ii Comments (nested one level) | ✅ `GET/POST /api/posts/<id>/comments`, `DELETE /api/comments/<id>`; thread UI in `comments.jsx` |
| e.i Admin users / moderators | ✅ `users.role`; admins assign roles in the dashboard or with `python manage.py set-role <user> admin` |
| f. Unit & integration tests ≥ 85% | ✅ backend 99% (61 tests), frontend 97% (81 tests) — see "Tests" above |
| e.ii Report system + admin dashboard | ✅ "דווח" on posts, comments and profiles → `POST /api/reports`; `#/admin` (`admin.jsx`): report cases, delete content, ban / unban, roles |

Still mock data from the design: marketplace, store reviews, messages, notifications, saved items.

## Project layout

```
backend/    Flask API — app.py, routes/, schema.sql, seed.py, tests/
frontend/   Vite + React app (src/components = the design, wired to the API)
docs/       database diagram
design/     original Claude Design export (reference only)
```

## API summary

| Method | Path | |
|---|---|---|
| POST | `/api/auth/signup` · `/api/auth/login` · `/api/auth/logout` | auth |
| POST / GET / POST | `/api/auth/forgot` · `/api/auth/reset/<token>` · `/api/auth/reset` | password reset by email |
| GET | `/api/auth/me` | current user |
| GET | `/api/feed?scope=global\|following&before=&tag=` | feed page |
| POST | `/api/posts` | create (multipart: `kind`, `body`, `title`, `steps`, `tags`, `images[]`) |
| GET / DELETE | `/api/posts/<id>` | read / delete own |
| GET | `/api/users/<username>` · `/posts` · `/followers` · `/following` | profile |
| POST / DELETE | `/api/users/<username>/follow` | follow / unfollow |
| POST / DELETE | `/api/posts/<id>/like` | like / unlike |
| GET / POST | `/api/posts/<id>/comments` | thread / add (`body`, optional `parent_id`) |
| DELETE | `/api/comments/<id>` | by the comment's or the post's author |
| PUT | `/api/users/me` | edit profile (multipart, optional `avatar`) |
| GET | `/api/users/search?q=` · `/api/users/suggested` · `/api/search?q=` · `/api/tags/trending` | discovery |
| POST | `/api/reports` | report a post / comment / user (`target_type`, `target_id`, `reason`, `details`) |
| GET | `/api/admin/stats` · `/api/admin/reports?status=open\|closed` · `/api/admin/users?q=&filter=` | dashboard (moderators) |
| POST | `/api/admin/cases/dismiss` · `/api/admin/users/<u>/ban` · `/api/admin/users/<u>/unban` | moderation actions |
| PUT | `/api/admin/users/<u>/role` | change role (admins only) |
