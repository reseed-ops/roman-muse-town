#!/bin/sh
# Task 94: serve the local web build (pglite) and run the director on a scene file.
#   tools/tour/direct.sh tools/tour/scenes/wedding-arch.json
#   tools/tour/direct.sh tools/tour/scenes/wedding-arch.json --note "closer, zoom the camera"
# Reuses web/dist unless DIRECT_BUILD=1. See tools/tour/README.md.
set -e
cd "$(dirname "$0")/../.."
PORT="${TOUR_PORT:-8099}"
[ -z "$DIRECT_BUILD" ] || bun run build:web
fuser -k "$PORT/tcp" >/dev/null 2>&1 || true
bun tools/idyllic/serve-local.ts "$PORT" >/tmp/tour-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -fs "http://localhost:$PORT/healthz" >/dev/null 2>&1 && break; sleep 1; done
~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/director.py --url "http://localhost:$PORT/" "$@"
