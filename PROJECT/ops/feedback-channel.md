# The feedback channel — a tagged phone speaks, the agent reads (ADR 0014)

## Tag a device, once
Open `https://entry.zacoberg.com/?report=<name>` on it. From then on every visit from that
browser is tagged, and a line under the composer says so. `?report=off` forgets it.

## Read what it said
```
TOK=$(grep -E "^ENTRY_HUB_WRITE_TOKEN=" /c/code/creds.local.txt | sed -E 's/^[^=]+=([0-9a-f]+).*/\1/')
curl -s -H "X-Write-Token: $TOK" "https://entry.zacoberg.com/api/debug-log/tail?src=report&n=200"
```
One JSON row per beacon: `at`, `build`, `reporter`, `ua`, `events`. The words are in events of
type `report-said` (what the engine heard when the mic closed, with `src`), `report-release` (what
was released, with `typed`) and `report-text`. The same rows sit in the device log with the lag,
listen, perf and engine rows of the session around them: read both.

## What to do with it
A report is an inbox item. A defect becomes a hub task citing the row's `at` and `sid`; a judgment
about how the piece should behave becomes an ADR amendment. Reports are not deleted; the file
rotates at 16 MB.

## Start of every entry session
Tail the report log first. If the phone said something since the last read, that is the work.
