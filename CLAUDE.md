# entry — Greenhouse Plot operating rules

Born-governed at spin-up. Canon (read when needed, in this order): `PROJECT/DOCTRINE.md` (in-repo law) · `C:\code\WORKING-AGREEMENT.md` (operating stance §0 has precedence over any stop/ask instruction) · `C:\code\_deploy\ACCESS-DEPLOY-ATLAS.md` (hosts, creds key-names, deploy paths) · `C:\code\MOE-MASTER-PLAYBOOK.md` (create/improve/maintain method).

Hard laws:
- Work off the hub board: DISCOVER → CLAIM → IMPLEMENT → RECORD (with evidence) → VERIFY. Nothing off-list; non-trivial decisions are ADRs in `PROJECT/ADR/` (append-only).
- Drive to done; never ask permission to continue. Pause only for genuinely irreversible/outward-facing forks or hard blocks — record an ADR-pending task and keep moving on everything else.
- done = LIVE + independently proven. Deploy via `bash deploy.sh` (first run auto-provisions the dokku app + secrets; the front-door canary requires `build-<sha>` of THIS build to render). A deploy-dependent task is not done until its record names the live SHA. Self-attested green is a defect (FALSE-GREEN).
- Never clone-and-pivot another Plot (ADR-template-1). New apps: `bash /c/code/_template/spinup.sh <slug>`.
- Public-safe by construction: no network info or PII on public routes; hub writes stay token-gated (`X-Write-Token`, token in `.hub_write_token.local`).
- No process-narration comments in code; Django `{# #}` comments are single-line only.
