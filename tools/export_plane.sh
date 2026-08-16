#!/usr/bin/env bash
# Export the Project Plane as a standalone distributable: C:\code\project-plane (+ .zip via
# Compress-Archive afterwards). Contains everything another machine needs — the self-contained
# bootstrap spec, the canonical PROJECT/ tree, and the embed builder/drift-checker.
set -euo pipefail
TPL="$(cd "$(dirname "$0")/.." && pwd)"
OUT="/c/code/project-plane"
[ -e "$OUT" ] && rm -rf "$OUT"
mkdir -p "$OUT/tools"

cp "$TPL/PROJECT-PLANE-BOOTSTRAP.md" "$OUT/"
cp "$TPL/tools/build_bootstrap.py" "$OUT/tools/"
(cd "$TPL" && tar --exclude='./PROJECT/.hub' --exclude='__pycache__' -cf - ./PROJECT) | (cd "$OUT" && tar -xf -)

cat > "$OUT/README.md" <<'EOF'
# THE PROJECT PLANE — distributable package

A complete, project-agnostic, verifiable project-management framework for agent-driven work:
source-of-truth ledger discipline, ADRs, research + registers, audit history, independent
verification with fail-closed gates, and the leader/worker/verifier campaign protocol (v2.1).

## Contents
- `PROJECT-PLANE-BOOTSTRAP.md` — the fully SELF-CONTAINED spec (laws · architecture · entity
  model · all 33 templates/schemas embedded byte-exact · bootstrap procedure · setup self-test).
  This single file is sufficient on its own.
- `PROJECT/` — the canonical folder tree, ready to copy into a repo root as-is.
- `tools/build_bootstrap.py` — regenerates/verifies the spec's embedded templates from
  `PROJECT/` (`--check` = drift gate). Run from this folder: `python tools/build_bootstrap.py --check`.

## Two ways to use it
1. **Fresh environment, nothing available:** give an agent `PROJECT-PLANE-BOOTSTRAP.md` alone and
   say "set up the Project Plane per this spec." It follows §6 (bootstrap) and proves itself with
   §7 (the setup self-test — the gate must FAIL six seeded violations before it may pass).
2. **This package available:** copy `PROJECT/` into the new repo root, then follow bootstrap §6
   from step 3 (bind the substrate, wire the fail-closed gate, record ADR-0001, fill
   CHARTER/HANDOFF, run the §7 self-test).

Read-order for any agent: `PROJECT/README.md` (the map) → `HANDOFF.md` → `CHARTER.md` →
`DOCTRINE.md`; `PROJECT/pm/PROTOCOL.md` when running multiple agent seats.
EOF

echo "Exported to $OUT:"
(cd "$OUT" && find . -type f | sort | head -50)
(cd "$OUT" && python tools/build_bootstrap.py --check)
