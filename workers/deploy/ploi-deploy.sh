#!/bin/bash
# Ploi deploy script for workers.
#
# Paste into Ploi → Site → Deploy → Deployment script. Ploi runs it as the
# `ploi` user with the site directory as CWD; it aborts on the first command
# that exits non-zero.
#
# Assumptions:
#   - Node 22 + pnpm 11 (corepack) are installed on the server.
#   - .env lives in the site directory and is NOT in git — it survives deploys.
#   - The processes run as Ploi daemons (Server → Daemons); put their ids in
#     DAEMONS below. `sudo supervisorctl status` prints the exact names.

set -euo pipefail

# Ploi runs the deploy script from the site directory, and the site's system
# user may not be `ploi` (isolated-user sites live under /home/<their user>,
# mode 0750 — hardcoding /home/ploi/... gets "cd: Permission denied"). Derive
# it instead; override by exporting SITE_DIR if you ever need to.
SITE_DIR="${SITE_DIR:-$PWD}"
BRANCH="main"

# Ploi doesn't let you name daemons — it assigns an id and writes the supervisor
# program as `worker-<id>`. Rather than hardcode ids that change whenever a
# daemon is recreated, discover this site's daemons from the `directory=` Ploi
# wrote into each supervisor config (the configs are world-readable, so this
# needs no privileges). Leave empty to auto-discover.
DAEMONS=()

# Restarting does need privileges, and the site runs as an isolated user with no
# passwordless sudo — so it goes through the Ploi API. Put PLOI_TOKEN and
# PLOI_SERVER in this file (chmod 600, outside the repo). See deploy/README.md.
PLOI_CREDS="$HOME/.ploi-deploy.env"

cd "$SITE_DIR"

# Fail with something readable if we're not where we think we are.
[ -f package.json ] || { echo "✗ $SITE_DIR is not the repo root (no package.json)"; exit 1; }

# Ploi's deploy shell is non-interactive and doesn't source nvm/corepack shims.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null
corepack enable >/dev/null 2>&1 || true

echo "→ fetching $BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"   # deploys are one-way; local edits are discarded

# --prod=false is deliberate: tsx and typescript are devDependencies and ARE
# the runtime here (there is no compiled dist/). A production-only install
# would leave every daemon unable to start.
echo "→ installing dependencies"
pnpm install --frozen-lockfile --prod=false

# Fails the deploy before anything restarts if the tree doesn't compile —
# worth having when the runtime is tsx and there is no build to catch it.
echo "→ typecheck"
pnpm typecheck

# Drizzle's migrator takes an advisory lock and skips already-applied files,
# so this is safe to run on every deploy. Must run from the repo root.
echo "→ migrating database"
pnpm db:migrate

if [ "${#DAEMONS[@]}" -eq 0 ]; then
  # Each Ploi daemon gets /etc/supervisor/conf.d/worker-<id>.conf carrying the
  # `directory=` it was created with. Matching on the site dir picks up exactly
  # this site's daemons and ignores every other site on the server.
  for conf in /etc/supervisor/conf.d/worker-*.conf; do
    [ -e "$conf" ] || continue   # glob didn't match: no daemons on this server
    dir="$(sed -n 's/^directory=[[:space:]]*//p' "$conf" 2>/dev/null \
      | head -1 | sed 's#/*$##' | tr -d '[:space:]')"
    [ "$dir" = "${SITE_DIR%/}" ] && DAEMONS+=("$(basename "$conf" .conf)")
  done
fi

# shellcheck source=/dev/null
[ -r "$PLOI_CREDS" ] && . "$PLOI_CREDS"

echo "→ restarting daemons"
restarted=0
for daemon in "${DAEMONS[@]}"; do
  if [ -z "${PLOI_TOKEN:-}" ] || [ -z "${PLOI_SERVER:-}" ]; then
    echo "  ✗ $daemon — no Ploi API credentials in $PLOI_CREDS"
    break
  fi
  echo "  restarting $daemon"
  # The supervisor program is worker-<id>; the API wants the bare id.
  curl -fsS -X POST \
    "https://ploi.io/api/servers/${PLOI_SERVER}/daemons/${daemon#worker-}/restart" \
    -H "Authorization: Bearer ${PLOI_TOKEN}" \
    -H "Accept: application/json" >/dev/null
  restarted=$((restarted + 1))
done

# Nothing to health-check on a first deploy: the code is on the server but no
# daemon exists yet to serve it. Say so and stop, rather than failing on a
# connection refused that looks like a broken deploy.
if [ "$restarted" -eq 0 ]; then
  echo "! nothing restarted — code is deployed but may still be running old builds."
  echo "  Daemons must set directory=$SITE_DIR (see deploy/README.md) and"
  echo "  $PLOI_CREDS must define PLOI_TOKEN and PLOI_SERVER."
  echo "✓ deployed $(git rev-parse --short HEAD)"
  exit 0
fi

# Readiness pings Postgres and Redis, so this catches a bad .env too. Poll
# rather than sleep-once: tsx has to transpile the whole tree on boot before
# Fastify binds, which takes well over a second on a small VPS.
check() {
  local name="$1" url="$2" i
  for i in $(seq 1 15); do
    curl -fsS --max-time 5 "$url" >/dev/null 2>&1 && { echo "  ✓ $name ready"; return 0; }
    sleep 2
  done
  echo "  ✗ $name never became ready ($url)"
  echo "    sudo supervisorctl status        — is the daemon RUNNING?"
  echo "    sudo supervisorctl tail -10000 <daemon> stderr"
  return 1
}

echo "→ health checks"
check "messaging api" http://127.0.0.1:3002/health/ready
check "product api"   http://127.0.0.1:3001/health/ready

echo "✓ deployed $(git rev-parse --short HEAD)"
