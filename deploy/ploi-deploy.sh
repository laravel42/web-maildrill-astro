# Ploi deploy script — web-maildrill-astro (Astro 7, @astrojs/node standalone, pnpm workspace)
# Paste into Ploi › Site › "Deploy script". Ploi substitutes the {TOKENS} at run time.

cd {SITE_DIRECTORY}

# ── 1. Pull latest ─────────────────────────────────────────────────────────
git pull origin main

# ── 2. Node + pnpm (nvm + corepack) ────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -f .nvmrc ] && nvm use                 # else the site's default Node (need >= 20)
corepack enable
corepack prepare pnpm@latest --activate  # or pin, e.g. pnpm@9

# ── 3. Install + build ─────────────────────────────────────────────────────
pnpm install --frozen-lockfile           # installs the vendored packages/* too
pnpm run build                           # → dist/server/entry.mjs

# ── 4. Restart the app process ─────────────────────────────────────────────
# The Astro server is long-lived, so run it as a Ploi Daemon (Supervisor) — see
# notes below. Replace the program name with your daemon's (Ploi › Daemons, or
# `sudo supervisorctl status`). The `:*` restarts all its processes.
echo "" | sudo -S supervisorctl restart daemon-REPLACE_ME:*

# ── Alternative if you use PM2 instead of a Ploi Daemon ─────────────────────
# pm2 reload maildrill --update-env || pm2 start "node dist/server/entry.mjs" --name maildrill
