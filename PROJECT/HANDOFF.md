# HANDOFF — The Entry

> canonical living snapshot · update at every significant state change

## 0. Arrangement

SOLO principal-agent build with parallel read-only audits. Work is governed by the event-sourced Hub.
Canonical upstream for reusable Hub units: `C:/code/hub-scaffold` at recorded commit `64f7b00` or its
newer successor after any upstream correction.

## 1. Standing doctrine deltas

- ADR-0001: The Entry owns `entry.zacoberg.com`, its repository, release and Hub.
- ADR-0002: Hub improvements are upstream-first; no Entry-only scaffold fork.
- ADR-0003: visitor words never leave the browser.

## 2. Live state

- Standalone production: not deployed yet.
- Legacy experience: `https://zacoberg.com/entry/` remains live until cutover.
- Local Hub genesis: seeded with three ADRs and the complete extraction/release task graph.

## 3. In flight

- `entry:task:0001` — standalone project and canonical Hub adoption, owned by `codex-root`.
- Canonical Hub blockers discovered during adoption are tracked separately as `entry:task:0008`.

## 4. Backlog

Follow `/hub/next.json`: elevate product, prove locally, cut portfolio links, provision and deploy,
register everywhere, then perform an independent live release review.

## 5. Environment and access

- Deployment/access source: `C:/code/_deploy/ACCESS-DEPLOY-ATLAS.md`.
- Secrets remain in `C:/code/creds.local.txt` by key name; none belong in this repository.
- Hub runtime is persistent and untracked at `PROJECT/.hub/` locally and `$HUB_DIR` live.

## 6. Hard-won gotchas

- The old page's timer used pre-mutation `keydown` state, breaking first-character, paste, IME and
  mobile behavior. Drive release timing from the `input` event.
- Never transplant zacoberg.com's archive analytics merely to retain a page-view counter.
- Sync Gunicorn workers are incompatible with a long-held SSE stream; production must be threaded.
- First provisioning must not mint the Hub token inside a disposable deploy worktree.

## 7. Narrative

The Entry began in March 2026 as one 625-line template inside zacoberg.com. In August it gained a
portfolio doorway, revealing that its product identity and operational lifecycle deserved separation.
This project was spun up cleanly, immediately rebased onto canonical hub-scaffold, and is being elevated
without importing the parent site's unrelated data or tracking systems.
