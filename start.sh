#!/usr/bin/env bash
#
# One-command setup + run for HandyHub.
#   ./start.sh          install deps (first run) and start API + frontend
#   ./start.sh --seed   also reset the database and load the demo data
#
# Before the first run: copy backend/.env.example → backend/.env and set DB_PASSWORD.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

if [ ! -f "$BACKEND/.env" ]; then
  echo "!! backend/.env is missing. Run:  cp backend/.env.example backend/.env  and set DB_PASSWORD."
  exit 1
fi

# ── 1. Backend: virtualenv + requirements ────────────────────────────────────
echo "==> Backend setup…"
if [ ! -d "$BACKEND/.venv" ]; then
  python3 -m venv "$BACKEND/.venv"
fi
PY="$BACKEND/.venv/bin/python"
"$PY" -m pip install --quiet --upgrade pip
"$PY" -m pip install --quiet -r "$BACKEND/requirements.txt"

if [ "${1:-}" = "--seed" ]; then
  echo "==> Resetting database + loading demo data…"
  (cd "$BACKEND" && "$PY" seed.py --reset)
else
  (cd "$BACKEND" && "$PY" seed.py)   # creates tables if missing, seeds only an empty DB
fi

# ── 2. Frontend: npm dependencies ────────────────────────────────────────────
echo "==> Frontend setup…"
if [ ! -d "$FRONTEND/node_modules" ]; then
  (cd "$FRONTEND" && npm install)
fi

# ── 3. Run both ──────────────────────────────────────────────────────────────
cleanup() { [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "==> API      → http://localhost:5050"
(cd "$BACKEND" && "$PY" app.py) &
API_PID=$!

echo "==> Frontend → http://localhost:5173   (Ctrl+C stops both)"
cd "$FRONTEND" && npm run dev
