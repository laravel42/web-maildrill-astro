# Deploying on Ploi

`ploi-deploy.sh` is the deployment script for the Ploi site. Paste its contents
into **Ploi → Site → Deploy → Deployment script**, then fill in the daemon ids.

## Which system user runs the deploy?

Ploi sites are either owned by the shared `ploi` user or by an isolated
per-site user. This decides two things, so check it first — paste this as a
throwaway deploy script and run one deploy:

```bash
pwd; whoami; ls -ld "$PWD"; which pnpm node
```

- **Site directory** — never hardcode `/home/ploi/<domain>`. The script uses
  `$PWD`, which is correct for both. A hardcoded path against an isolated user
  gives `cd: /home/ploi/...: Permission denied`.
- **sudo** — only `ploi` has passwordless sudo. An isolated user cannot run
  `sudo supervisorctl restart`, so use the API restart below instead.

## Daemons are discovered, not named

Ploi has no name field for daemons — it assigns an id and writes the supervisor
program as `worker-<id>`. The deploy script therefore doesn't hardcode ids: it
reads `/etc/supervisor/conf.d/worker-*.conf` and restarts every daemon whose
`directory=` equals the site directory.

The one thing this depends on: **set each daemon's directory to exactly the
site root** when you create it. A daemon pointed somewhere else still runs, but
deploys will never restart it, so it silently keeps serving old code.

To see what the script will match:

```bash
grep -l "directory=$PWD" /etc/supervisor/conf.d/worker-*.conf
sudo supervisorctl status
```

## Checking what's running

```bash
sudo supervisorctl status          # every daemon on the server, by id
```

Ids are opaque, so to see the command and directory behind each one:

```bash
for c in /etc/supervisor/conf.d/worker-*.conf; do
  id=$(basename "$c" .conf)
  echo "== $(sudo supervisorctl status "$id:*")"
  grep -h -e '^command=' -e '^directory=' "$c" | sed 's/^/   /'
done
```

A daemon can report `RUNNING` while the app inside it is broken, so also check
the sockets and the logs:

```bash
ss -tlnp | grep -E ':(3002|3001|3003)'
sudo supervisorctl tail -10000 <daemon-id> stderr
```

## Restarting daemons without sudo

This site runs as an isolated system user with no passwordless sudo, so the
deploy cannot run `supervisorctl`. It restarts daemons through the Ploi API
instead, which needs no shell privileges. Discovery still works unprivileged —
the configs in `/etc/supervisor/conf.d/` are world-readable.

Create `~/.ploi-deploy.env` as the site user, mode 0600:

```bash
umask 077
cat > ~/.ploi-deploy.env <<'EOF'
PLOI_TOKEN=<Ploi → Profile → API keys>
PLOI_SERVER=<the server id in the Ploi URL>
EOF
```

The script sources it and calls
`POST /api/servers/{server}/daemons/{id}/restart` per daemon. The API wants the
bare numeric id, hence `${daemon#worker-}` — `worker-<id>` is the supervisor
program name, `<id>` is Ploi's daemon id.

If a deploy prints "no Ploi API credentials", that file is missing or
unreadable; the deploy still ships code but leaves the old processes running.

## Daemon commands

Create these under **Ploi → Server → Daemons**, all with **directory** set to
the site root and **user** set to the site's system user:

| Command                                        | Port | Notes                                          |
| ---------------------------------------------- | ---- | ---------------------------------------------- |
| `bash -lc 'exec pnpm start:api'`               | 3002 | messaging API                                  |
| `bash -lc 'exec pnpm start:product-api'`       | 3001 | product API                                    |
| `bash -lc 'exec pnpm start:email-builder-api'` | 3003 | AI backend; only if the frontend uses `/api/*` |
| `bash -lc 'exec pnpm worker all'`              | —    | BullMQ workers; or one daemon per role         |

Three things that will bite you, all of which have already happened once:

- **`bash -lc` is not decoration.** Supervisor spawns with a minimal PATH and no
  login shell, so an nvm-installed `pnpm` is not found. The login shell sources
  the profile that puts it on PATH. `exec` keeps the process tree flat so
  supervisor signals the Node process, not a wrapper shell.
- **Leave the environment field empty.** Supervisor's `environment=` takes
  `KEY=value` pairs; pointing it at an `.env` file writes a malformed line that
  makes _supervisord itself_ exit 2 and crash-loop, taking every daemon on the
  server down with it. `@maildrill/config` loads `.env` via dotenv from the
  working directory, so nothing is needed here.
- **Directory must be exactly the site root** — dotenv, pnpm workspace
  resolution and the deploy script's daemon discovery all key off it.

Raise `stopwaitsecs` above the default 10s for the worker daemon: its SIGTERM
handler drains in-flight sends before exiting.
