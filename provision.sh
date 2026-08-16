#!/usr/bin/env bash
# Idempotent dokku provisioning for this Plot — safe to run on EVERY deploy (deploy.sh does).
# Creates the app, persistent storage, and fail-closed secrets ONLY where missing, so a fresh
# spin-up ships with zero manual infrastructure steps and an existing app is untouched.
# Wildcard DNS (*.zacoberg.com -> the box) means there is no per-app DNS step.
#   BOX=user@host bash provision.sh <app>     (default box: zcobe@192.168.1.13, NAS dokku)
set -euo pipefail
APP="${1:?usage: provision.sh <app>}"
BOX="${BOX:-zcobe@192.168.1.13}"
SSHK=(-i "$HOME/.ssh/id_rsa" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
S() { ssh "${SSHK[@]}" "$BOX" "$@"; }

if ! S "sudo dokku apps:exists $APP >/dev/null 2>&1"; then
  echo "==> provision: creating dokku app '$APP' on $BOX"
  S "sudo dokku apps:create $APP"
fi

# Server-side push gate (out-of-process enforcement): chain the secret-blocking pre-receive gate
# into this app's receiver, preserving dokku's own hook. Idempotent; skips if the box lacks it.
S "sudo /usr/local/bin/install-pre-receive-gate.sh $APP 2>/dev/null || true"

# Front door: the box's global vhost is NOT zacoberg.com, so the app must claim its subdomain
# explicitly (the *.zacoberg.com wildcard tunnel routes by Host header to nginx :80).
if ! S "sudo dokku domains:report $APP 2>/dev/null | grep -q '$APP.zacoberg.com'"; then
  echo "==> provision: claiming $APP.zacoberg.com + mapping port 80"
  S "sudo dokku domains:set $APP $APP.zacoberg.com && sudo dokku ports:set $APP http:80:5000"
fi

if ! S "sudo dokku storage:list $APP 2>/dev/null | grep -q ':/app/data'"; then
  echo "==> provision: mounting persistent storage at /app/data"
  S "sudo dokku storage:ensure-directory $APP >/dev/null && sudo dokku storage:mount $APP /var/lib/dokku/data/storage/$APP:/app/data"
fi

if ! S "sudo dokku config:get $APP HUB_DIR >/dev/null 2>&1"; then
  echo "==> provision: pinning HUB_DIR to the persistent mount (unset = the hub event store lives on the container's writable layer and every redeploy silently wipes all governance data)"
  S "sudo dokku config:set --no-restart $APP HUB_DIR=/app/data/.hub"
fi

if ! S "sudo dokku config:get $APP SECRET_KEY >/dev/null 2>&1"; then
  echo "==> provision: minting SECRET_KEY (fail-closed setting requires it)"
  S "sudo dokku config:set --no-restart $APP SECRET_KEY=\$(openssl rand -hex 32)"
fi

if ! S "sudo dokku config:get $APP HUB_WRITE_TOKEN >/dev/null 2>&1"; then
  echo "==> provision: minting HUB_WRITE_TOKEN (without it the hub write path is dead)"
  TOK="$(openssl rand -hex 32 2>/dev/null || S 'openssl rand -hex 32')"
  S "sudo dokku config:set --no-restart $APP HUB_WRITE_TOKEN=$TOK"
  printf '%s\n' "$TOK" > "$(dirname "$0")/.hub_write_token.local"
  echo "    token written to .hub_write_token.local (gitignored) — agents send it as X-Write-Token"
fi

echo "==> provision: $APP ready on $BOX"
