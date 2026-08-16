# INFRA INVENTORY — deploy & ops runbook

> template → canonical once filled · owner: whoever touches infra · update: same session as any infra change; re-verify the "verified" stamp when read cold

**Verified against real config files on: 2026-08-16 by codex-root** — a runbook that hasn't been re-verified
against source is a rumor. Secrets stay in the atlas/creds files BY KEY NAME
(`C:\code\_deploy\ACCESS-DEPLOY-ATLAS.md` + `C:\code\creds.local.txt`); this file holds structure, never values.

## Process & boot

Django 6 on Python 3.12, served by threaded Gunicorn behind Dokku. Boot order is migrate, idempotent
Hub genesis seed, then Gunicorn. Two worker processes with multiple threads keep the long-lived SSE
connection from starving the product front door.

## Deploy paths
- **Code:** command, owner (campaigns: seat per `pm/PROTOCOL.md` §7), gates it must pass, expected
  duration + the patience notes (what a "hung" deploy actually is).
- **Data:** command, owner, pre-ship gates, the stop/swap/start window behavior.
- **Sequencing law:** code-first when a change spans both (new code tolerates old data; old code
  on new data produces user-visible lies).

- **Code:** `bash deploy.sh`; it provisions from the durable main checkout, builds a clean detached
  HEAD, runs `hubaudit` and product checks, ships, and proves the exact build at the public origin.
- **Data:** visitor content has no data plane. Django and Hub runtime live on the persistent app mount.

## Environment variables
| Var | Purpose | Notes (key name in creds, never the value) |
|---|---|---|
| `SECRET_KEY` | Django signing | minted during provisioning |
| `HUB_WRITE_TOKEN` | token-gated Hub mutations | minted during provisioning; local copy gitignored |
| `HUB_DIR` | persistent append-only Hub store | `/app/data/.hub` |
| `ALLOWED_HOSTS` | optional additional hostnames | canonical host is built in |

## Storage & mounts

Dokku persistent storage mounts at `/app/data`; SQLite is `/app/data/db.sqlite3` and the Hub ledger is
`/app/data/.hub`. Backup wiring is not asserted until implemented and proven.

## Front door & TLS

Canonical host: `entry.zacoberg.com`. Final direct-origin/DNS/TLS topology is decided and recorded before
provisioning. Canary must prove `/`, `/health/`, `/hub/cursor.json`, and the exact build SHA over HTTPS.

## Recovery

No standalone production incident exists yet. A failed first release leaves the legacy
`zacoberg.com/entry/` route untouched; cutover occurs only after the independent origin is green.
