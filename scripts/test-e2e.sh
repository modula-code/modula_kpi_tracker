#!/bin/sh
# End-to-end: runs the app on :3003 against the local Keycloak (centralauth: npm run kc) and runs
# test/e2e/app.test.ts, then restarts it with Keycloak unreachable (HUB_ISSUER on a closed port;
# the shared Keycloak itself is never touched) and runs test/e2e/outage.test.ts.
# Odoo points at a closed port so tests never call it. The app's log is in .next/e2e.log.
set -eu
cd "$(dirname "$0")/.."
set -a
. ./test/local.env
set +a
export ODOO_URL=http://127.0.0.1:9
mkdir -p .next
APP_PID=
trap 'if [ -n "$APP_PID" ]; then kill $APP_PID 2>/dev/null || true; fi' EXIT INT TERM

start() {
  node_modules/.bin/next dev --port 3003 >> .next/e2e.log 2>&1 &
  APP_PID=$!
  i=0
  until curl -fs -o /dev/null http://localhost:3003/login; do
    i=$((i + 1))
    if [ "$i" -ge 120 ]; then echo "app did not start; see .next/e2e.log" >&2; exit 1; fi
    sleep 1
  done
}

stop() {
  kill $APP_PID
  wait $APP_PID 2>/dev/null || true
  APP_PID=
}

run() {
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=test/local.env --test --test-concurrency=1 "$@"
}

: > .next/e2e.log
start
run test/e2e/app.test.ts
stop

export HUB_ISSUER=http://localhost:9/realms/modula
start
run test/e2e/outage.test.ts
stop
