#!/usr/bin/env bash
#
# End-to-end tests (Cypress): a real browser against the real app — Vite → Flask → MySQL.
#   ./e2e.sh          run every spec headless (screenshots of failures in frontend/cypress/screenshots)
#   ./e2e.sh --open   open the Cypress window to watch the tests / pick a spec
#   ./e2e.sh --spec cypress/e2e/posts.cy.js   any other arguments go to `cypress run`
#
# It uses its own database (handyhub_e2e, rebuilt from the migrations on every run) and its own ports
# (API 5051, site 5174), so your data and a running ./start.sh are not touched. AI and agents are off
# (no course quota used); emails are written to files so the tests can follow the password-reset link.
# Needs ./start.sh to have run once (it creates backend/.venv and installs the frontend packages).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PY="$BACKEND/.venv/bin/python"
API_PORT=5051
WEB_PORT=5174
TMP="$FRONTEND/cypress/tmp"

if [ ! -x "$PY" ] || [ ! -d "$FRONTEND/node_modules" ]; then
  echo "!! Run ./start.sh once first (it creates backend/.venv and installs the frontend packages)."
  exit 1
fi
for port in $API_PORT $WEB_PORT; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    echo "!! Port $port is in use — is another ./e2e.sh still running?  kill \$(lsof -tiTCP:$port -sTCP:LISTEN)"
    exit 1
  fi
done

# Settings for this run only (they win over backend/.env; DB user / password still come from there)
export DB_NAME=handyhub_e2e
export AI_PROVIDER=off AGENTS_ENABLED=0
export MAIL_BACKEND=file MAIL_FILE_DIR="$TMP/mail"
export UPLOAD_DIR="$TMP/uploads"
export APP_URL="http://localhost:$WEB_PORT" COOKIE_SECURE=0
export GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET=

cleanup() {
  for pid in ${API_PID:-} ${WEB_PID:-}; do
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

rm -rf "$TMP"
mkdir -p "$TMP/mail" "$TMP/uploads"

echo "==> Fresh e2e database ($DB_NAME): migrations + demo data"
(cd "$BACKEND" && "$PY" seed.py --reset --yes) > "$TMP/seed.log" 2>&1 || { cat "$TMP/seed.log"; exit 1; }

echo "==> API on :$API_PORT, site on :$WEB_PORT (logs in frontend/cypress/tmp/)"
(cd "$BACKEND" && exec "$PY" -c "from app import create_app; create_app().run(host='127.0.0.1', port=$API_PORT)") \
  > "$TMP/api.log" 2>&1 &
API_PID=$!
(cd "$FRONTEND" && API_URL="http://127.0.0.1:$API_PORT" exec npx vite --port $WEB_PORT --strictPort) \
  > "$TMP/web.log" 2>&1 &
WEB_PID=$!

for i in $(seq 1 60); do
  if curl -sf "http://localhost:$WEB_PORT/api/health" >/dev/null 2>&1; then break; fi
  if [ "$i" = 60 ]; then echo "!! The app didn't start — see frontend/cypress/tmp/api.log and web.log"; exit 1; fi
  sleep 0.5
done

cd "$FRONTEND"
if [ "${1:-}" = "--open" ]; then
  npx cypress open --e2e
else
  npx cypress run --e2e "$@"
fi
