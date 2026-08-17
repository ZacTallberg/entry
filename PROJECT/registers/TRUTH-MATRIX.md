# TRUTH MATRIX — every rendered claim vs its derivation

> canonical · owner: worker maintains, verifier audits · update: whenever a field or surface is added/changed — this IS the acceptance checklist for new surfaces

**The contract (DOCTRINE §2.2):** machine-derived factual claims trace deterministically to their
source of truth and show uncertainty honestly. Editorial copy, visual style and motion are not test
targets; the real rendered experience is their proof.

## Fields
| Field | Derivation (source of truth) | Detector (class check) | Presentation rule |
|---|---|---|---|
| Product name | `PROJECT/project.json.brand` and template constant | identity coherence check | Always “The Entry”; never generic Plot copy |
| Canonical origin | `PROJECT/project.json.live_url` | canonical/Host response check | `https://entry.zacoberg.com` only |
| Build identity | `app/build_sha.txt` baked from deployed HEAD | live canary compares exact SHA | Hidden metadata; never self-asserted green |
| Privacy promise | absence of product mutation endpoints and content-bearing browser requests | real browser network observation; a transient probe only when this critical boundary changes | “nothing is saved” appears only while invariant passes |
| Release state | client state machine driven by current input/timers | real input, paste, IME and cancellation operation | announced through a polite live region; not color-only |
| Hub connection | persistent SSE receives canonical patches; cursor recovery runs only after a disconnect | live connection and mutation behavior | Exactly Connected or Disconnected; no polling/manual state |

## Surfaces
One entry per rendering surface (page, card, modal, feed, API, export). For each: which fields it
renders and coverage status vs this table. A surface may not ship until its every field has a row.

- `/`: product name, canonical origin, build identity, privacy promise, release state.
- `/health/`: product name and build identity only; no visitor or infrastructure details.
- `/hub/` and Hub JSON surfaces: canonical ledger-derived project state and connection state.
- `/.well-known/agent-card.json`: project identity and supported agent interface only.

## Operating evidence

Use the affected real product, Hub, deploy, or registry path and retain its task receipt. A security,
privacy, destructive-data, migration, protocol, or concurrency seam may justify one transient probe;
delete it before commit. Do not turn copy, style, motion, or an ordinary fix into a permanent suite.
