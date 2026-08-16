# TRUTH MATRIX — every rendered claim vs its derivation

> canonical · owner: worker maintains, verifier audits · update: whenever a field or surface is added/changed — this IS the acceptance checklist for new surfaces

**The contract (DOCTRINE §2.2):** every field the product renders is an assertion. Each must have a
deterministic derivation from gathered evidence, a class detector that would catch a lie, and a
presentation rule that shows its certainty honestly (an unverified value must LOOK unverified —
honest disclosure doesn't block ships; overclaim does).

## Fields
| Field | Derivation (source of truth) | Detector (class check) | Presentation rule |
|---|---|---|---|
| Product name | `PROJECT/project.json.brand` and template constant | identity coherence check | Always “The Entry”; never generic Plot copy |
| Canonical origin | `PROJECT/project.json.live_url` | canonical/Host response check | `https://entry.zacoberg.com` only |
| Build identity | `app/build_sha.txt` baked from deployed HEAD | live canary compares exact SHA | Hidden metadata; never self-asserted green |
| Privacy promise | absence of product mutation endpoints and content-bearing browser requests | template/static scan plus browser network observation | “nothing is saved” appears only while invariant passes |
| Release state | client state machine driven by current input/timers | interaction tests across input, paste, IME and cancellation | announced through a polite live region; not color-only |
| Hub connection | SSE → delta/canonical reread with polling/manual fallback | Hub conformance probes | Explicit live/reconnecting/polling/manual state |

## Surfaces
One entry per rendering surface (page, card, modal, feed, API, export). For each: which fields it
renders and coverage status vs this table. A surface may not ship until its every field has a row.

- `/`: product name, canonical origin, build identity, privacy promise, release state.
- `/health/`: product name and build identity only; no visitor or infrastructure details.
- `/hub/` and Hub JSON surfaces: canonical ledger-derived project state and connection state.
- `/.well-known/agent-card.json`: project identity and supported agent interface only.

## Eval probes
Where the never-again probes live for this table (test module / eval file), so regressions are mechanical.

- `app/tests.py` — root, metadata, privacy and fallback contracts.
- `tools/live_canary.py` — canonical origin, build and Hub reachability.
- `tools/registry_canary.py` — public catalog and Homebase identity.
- Browser release review — input state, network privacy, responsive and motion-preference evidence.
