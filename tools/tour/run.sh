#!/bin/sh
# Task 90: build the local web build, serve it (pglite, no Railway), tour it, stop the server.
#   tools/tour/run.sh [tour.py options]      e.g. --golden, --only forum,baths
# To tour the live site instead: python3 tools/tour/tour.py --url https://town.reseed.net/
# (works once a deploy carries the ?tour hook; see README.md).
set -e
cd "$(dirname "$0")/../.."
PORT="${TOUR_PORT:-8099}"
[ -n "$TOUR_SKIP_BUILD" ] || bun run build:web
fuser -k "$PORT/tcp" >/dev/null 2>&1 || true
bun tools/idyllic/serve-local.ts "$PORT" >/tmp/tour-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -fs "http://localhost:$PORT/healthz" >/dev/null 2>&1 && break; sleep 1; done
~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/tour.py --url "http://localhost:$PORT/" "$@"
