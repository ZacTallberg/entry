# CHARTER — The Entry

> canonical · owner: principal agent · scope changes require a new ADR

## 1. Mission

The Entry gives any visitor a quiet place to say something, see their language become motion, and
let it disappear. The sentence a stranger should repeat is: **write into the dark; nothing is kept.**

## 2. Users & surfaces

- **Visitor:** `https://entry.zacoberg.com/` on phone, tablet, or desktop.
- **Operator:** the same public experience plus deployment and health evidence.
- **Agents:** `/hub/`, `/hub/api/mcp`, `/.well-known/agent-card.json`, and the typed Hub APIs.
- **Portfolio:** zacoberg.com Apps and Homebase link to the standalone origin.

## 3. Scope

- A responsive text-to-motion artwork with an explicit release action and contemplative auto-release.
- Browser-local, non-persistent visitor words.
- Adaptive graphics, reduced-motion and graphics-fallback experiences.
- Current canonical Hub cockpit: event ledger, strict completion, realtime SSE/delta/cursor,
  delivery truth, MCP and truthful discovery.
- Independent build, deployment, HTTPS origin, health proof, and portfolio identity.

## 4. Non-goals

- A message board, confession archive, moderation system, or content corpus.
- Accounts, profiles, voting, sharing visitor text, or text analytics.
- A second implementation of reusable Hub capabilities.

## 5. Quality bar

- The artwork—not navigation or dashboard chrome—owns the first viewport.
- Motion is organic, input-responsive and quiet when idle; it never obstructs writing.
- The experience remains usable without WebGL and honors `prefers-reduced-motion`.
- Public routes disclose no private board data beyond the intentionally publishable task plane.
- `hubaudit`, product checks, browser QA and the deployed-artifact canary must agree.

## 6. Definition of done

1. The root, health route, Hub, realtime cursor/delta/SSE, MCP and discovery surfaces are reachable.
2. Automated and browser checks prove that typed text produces no content-bearing network request.
3. Phone and desktop layouts, keyboard/touch input, reduced motion and graphics fallback are exercised.
4. The live build SHA equals the repository and deploy record; HTTPS is healthy.
5. zacoberg.com redirects its old Entry route and links the standalone origin.
6. Homebase recognizes The Entry as an independent project with its own Hub.
7. No P0/P1 gap remains and `HANDOFF.md` names the verified live state.

## 7. Run model & cost ceiling

One small public Django service with two threaded Gunicorn workers and persistent SQLite/Hub storage.
No paid model, data, or rendering APIs run in the visitor path. Graphics execute only on the visitor's
device and adapt downward when the device or preference asks for less.

## 8. Data & legal posture

Visitor text never crosses the network. The application may emit content-free operational logs and
health measurements only. No visitor identity, behavioral profile, or creative text corpus is created.
