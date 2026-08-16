#!/usr/bin/env bash
# Deploy this Plot from a CLEAN detached worktree of HEAD — uncommitted files can never ship
# (openmic ADR-0100 pattern). Order: provision (idempotent) -> gate (hubaudit, born-safe
# invariants) -> build -> ship -> BUILD-SHA front-door canary. The canary requires the live page
# to serve build-<THIS sha> — a stale deploy, a swallowed release, or the unbuilt placeholder
# page can never pass (FALSE-GREEN discipline; pattern proven on openmic).
set -euo pipefail
cd "$(dirname "$0")"
APP="$(basename "$(pwd)")"

git rev-parse --git-dir >/dev/null 2>&1 \
  || { echo "ERROR: not a git repo — a Plot deploys its HEAD. Run: git init -b main && git add -A && git commit -m genesis" >&2; exit 2; }
if [ -n "$(git status --porcelain)" ]; then
  echo "WARN: dirty tree — deploy builds HEAD only; uncommitted changes will NOT ship. Commit first if they should." >&2
fi
SHA="$(git rev-parse --short HEAD)"

WT="/c/code/.deploy-wt-$APP"
git worktree remove --force "$WT" 2>/dev/null || true
git worktree add --detach "$WT" HEAD >/dev/null
printf '%s\n' "$SHA" > "$WT/app/build_sha.txt"   # baked into the image pre-build; served in <meta name="build">

(cd "$WT" \
  && bash ./provision.sh "$APP" \
  && bash /c/code/_deploy/offbox-deploy.sh --app "$APP" \
       --gate "DEBUG=1 SECRET_KEY=gate python manage.py hubaudit" \
       --canary "https://${APP}.zacoberg.com/" --expect "build-$SHA")

git worktree remove --force "$WT"
printf '%s\n' "$SHA" > app/build_sha.txt   # local stamp so the running checkout coheres with live

# Deploy record (uncommitted stamp): PROJECT/state.json feeds the hub's computed coherence, so
# 'no deploy record' stops being flagged and served==deployed==HEAD becomes checkable.
python - "$SHA" "https://${APP}.zacoberg.com/" <<'PY'
import json, pathlib, sys
p = pathlib.Path("PROJECT/state.json")
d = {}
if p.exists():
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except ValueError:
        d = {}
d.update({"last_deploy_sha": sys.argv[1], "live_url": sys.argv[2]})
p.write_text(json.dumps(d, indent=1) + "\n", encoding="utf-8")
PY
echo "==> deploy record: PROJECT/state.json last_deploy_sha=$SHA"
echo "==> done-record law: the hub task for this work names $SHA as its live evidence."
