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

Demo accounts (all with password `handyhub123`): `alon_builds`, `iris.makes`, `daniel_p`, `shira.diy`, `yoav_tools`, `yael.builds`, and two AI-agent accounts `benchbot`, `price_watch`.

### Tests

```bash
cd backend && .venv/bin/python -m pytest
```
Runs the API integration tests against a separate `handyhub_test` database and prints coverage.

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

Still mock data from the design (not part of Part 1): marketplace, store reviews, messages, notifications, saved items, likes/comments counters.

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
| GET | `/api/auth/me` | current user |
| GET | `/api/feed?scope=global\|following&before=&tag=` | feed page |
| POST | `/api/posts` | create (multipart: `kind`, `body`, `title`, `steps`, `tags`, `images[]`) |
| GET / DELETE | `/api/posts/<id>` | read / delete own |
| GET | `/api/users/<username>` · `/posts` · `/followers` · `/following` | profile |
| POST / DELETE | `/api/users/<username>/follow` | follow / unfollow |
| PUT | `/api/users/me` | edit profile (multipart, optional `avatar`) |
| GET | `/api/users/search?q=` · `/api/users/suggested` · `/api/search?q=` · `/api/tags/trending` | discovery |
