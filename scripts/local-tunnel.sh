#!/usr/bin/env bash
# Expose the local Astro server at a fixed URL through a named Cloudflare
# tunnel: https://local.maildrill.net → http://localhost:4321.
#
# One-time prerequisites (the script walks through them if missing):
#   brew install cloudflared
#   cloudflared tunnel login — the script triggers this when the maildrill.net
#     cert is missing. SELECT THE maildrill.net ZONE in the browser: login
#     certs are zone-scoped, and this machine's default cert.pem belongs to
#     laravel42.com (routing a maildrill.net hostname with it silently creates
#     "<hostname>.laravel42.com" instead). The maildrill cert is stored
#     separately as cert-maildrill.net.pem; cert.pem is left untouched so the
#     other tunnels on this machine keep working.
#
# Every cloudflared call pins --config: without it, cloudflared auto-loads
# ~/.cloudflared/config.yml (a different tunnel) and routes/runs against THAT
# tunnel no matter which name is passed on the command line.
#
# Idempotent: reuses the tunnel, writes the per-tunnel config if absent,
# (re-)points the DNS record, then runs in the foreground. Ctrl-C stops the
# tunnel; the DNS record stays, so the URL is fixed across runs.
set -euo pipefail

TUNNEL_NAME="${TUNNEL_NAME:-local-maildrill-app}"
TUNNEL_HOSTNAME="${TUNNEL_HOSTNAME:-local.maildrill.net}"
TUNNEL_SERVICE="${TUNNEL_SERVICE:-http://localhost:4321}"
CLOUDFLARED_DIR="$HOME/.cloudflared"
CONFIG_FILE="$CLOUDFLARED_DIR/$TUNNEL_NAME.yml"
ORIGIN_CERT="${ORIGIN_CERT:-$CLOUDFLARED_DIR/cert-maildrill.net.pem}"

command -v cloudflared >/dev/null 2>&1 || {
  echo "✗ cloudflared not found — install it with: brew install cloudflared" >&2
  exit 1
}

# One-time: obtain a maildrill.net-scoped cert without clobbering the default
# cert.pem (which belongs to another zone). Login always writes cert.pem, so
# park the existing one, log in, claim the fresh cert, then restore.
if [ ! -f "$ORIGIN_CERT" ]; then
  DEFAULT_CERT="$CLOUDFLARED_DIR/cert.pem"
  echo "→ one-time login for the maildrill.net zone — a browser will open."
  echo "  IMPORTANT: select the maildrill.net zone (the cert is zone-scoped)."
  RESTORE=""
  if [ -f "$DEFAULT_CERT" ]; then
    RESTORE="$DEFAULT_CERT.other-zone.bak"
    mv "$DEFAULT_CERT" "$RESTORE"
  fi
  ok=0
  if cloudflared tunnel login && [ -f "$DEFAULT_CERT" ]; then
    mv "$DEFAULT_CERT" "$ORIGIN_CERT"
    ok=1
  fi
  if [ -n "$RESTORE" ]; then
    mv "$RESTORE" "$DEFAULT_CERT"
  fi
  if [ "$ok" != 1 ]; then
    echo "✗ login failed — no cert written" >&2
    exit 1
  fi
fi

# Create the named tunnel once (NAME is column 2 of the list output).
if ! cloudflared tunnel --origincert "$ORIGIN_CERT" list 2>/dev/null \
  | awk '{print $2}' | grep -qx "$TUNNEL_NAME"; then
  echo "→ creating tunnel $TUNNEL_NAME"
  cloudflared tunnel --origincert "$ORIGIN_CERT" create "$TUNNEL_NAME"
fi

TUNNEL_ID="$(cloudflared tunnel --origincert "$ORIGIN_CERT" list 2>/dev/null \
  | awk -v n="$TUNNEL_NAME" '$2 == n {print $1}')"
[ -n "$TUNNEL_ID" ] || {
  echo "✗ could not resolve tunnel id for $TUNNEL_NAME" >&2
  exit 1
}

# Per-tunnel config, same convention as the other tunnels on this machine
# (~/.cloudflared/<name>.yml). Delete the file to regenerate it after changing
# TUNNEL_SERVICE/TUNNEL_HOSTNAME.
if [ ! -f "$CONFIG_FILE" ]; then
  echo "→ writing $CONFIG_FILE"
  cat > "$CONFIG_FILE" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CLOUDFLARED_DIR/$TUNNEL_ID.json

ingress:
  - hostname: $TUNNEL_HOSTNAME
    service: $TUNNEL_SERVICE
  - service: http_status:404
EOF
else
  echo "→ using existing $CONFIG_FILE"
fi

# Idempotent: creates the CNAME or re-points an existing record at this tunnel.
echo "→ routing $TUNNEL_HOSTNAME → $TUNNEL_NAME"
cloudflared tunnel --origincert "$ORIGIN_CERT" --config "$CONFIG_FILE" \
  route dns --overwrite-dns "$TUNNEL_NAME" "$TUNNEL_HOSTNAME"

echo "→ https://$TUNNEL_HOSTNAME → $TUNNEL_SERVICE (Ctrl-C to stop)"
exec cloudflared tunnel --origincert "$ORIGIN_CERT" --config "$CONFIG_FILE" run
