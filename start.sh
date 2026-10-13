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
# Stop the API *and* its child (Flask's auto-reloader) when this script exits.
cleanup() {
  if [ -n "${API_PID:-}" ]; then
    pkill -P "$API_PID" 2>/dev/null || true
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

for port in 5050 5173; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    echo "!! Port $port is already in use — probably HandyHub from an earlier run is still going."
    echo "   Stop it with:  kill \$(lsof -tiTCP:$port -sTCP:LISTEN)   and run ./start.sh again."
    exit 1
  fi
done

echo "==> API      → http://localhost:5050"
(cd "$BACKEND" && "$PY" app.py) &
API_PID=$!

echo "==> Frontend → http://localhost:5173   (Ctrl+C stops both)"
cd "$FRONTEND" && npm run dev
