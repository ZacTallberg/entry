# ADR-0014 — A device its holder has tagged sends its words; every other device never does

**Status:** accepted · 2026-10-24 · directed by operator · scope: the diagnostics channel
(`/api/debug-log`), the client's report mode, and what the page promises on a tagged device.

## Context

ADR 0003 makes the visitor's words ephemeral and ADR 0005 forbids transcript text in the
diagnostics channel. Both hold for visitors. They also left the operator with no way to use the
piece as its own feedback instrument: the operator wanted to stand in the piece on the phone, say
what is wrong with it, and have those words reach the agent that maintains it. The device log
already showed the phone on the site tonight (build c023f25, 01:37 UTC, several releases, hundreds
of lag rows) and not one word of what was said, because the only channel for words was a URL flag
(`?report=1`, task 0033) that had to be typed on every visit and was never on when it mattered.

## Decision

- A device becomes a **reporter** when its holder opens the page once with `?report=<name>`. The
  name is kept in that browser (`entry:reporter`) and every later visit from it, plain URL or
  home-screen icon, carries the tag. `?report=off` forgets it. `?report=1` keeps the name the
  device already has, or `phone` if it has none.
- A reporter's diagnostics carry `reporter: <name>` and three more event kinds:
  `report-said` (what the engine heard, at the moment the microphone closed, with the engine
  path that produced it), `report-release` (the released text, with whether it was typed), and
  `report-text` (a chunk-path final). Each holds up to the composer's 360 characters. A report
  is flushed the moment it is written rather than on the twelve-second beacon.
- The server keeps a reporter's rows in two places: the device log as before, and
  `report-log.jsonl` beside it on the mount, 16 MB with the same halving rotation. The device log
  turns over in days under lag rows; the report log holds months. `GET /api/debug-log/tail?src=report`
  returns it, under the same write token.
- The page tells the truth on a tagged device: a line under the composer reads "this device
  reports what it hears to the maker, as <name>". On every other device nothing changes and the
  promise "nothing is kept" stays exactly as true as it was.
- The agent that reads a report acts on it: a defect report becomes a hub task that cites the
  report row; a judgment becomes an ADR amendment. The log is the inbox, not the record.

## Consequences

- The operator can speak a defect into the piece on the phone and it arrives, with the engine
  path, the lag rows, the build and the device around it.
- ADR 0005's "forbidden forever" clause is narrowed: it binds untagged devices. A tag is an act
  by the device's holder, visible on the page, and reversible from the same place.
- Anyone who finds the flag can tag their own device. That sends only their own words, by their
  own hand, with the page saying so. It is not a leak of anyone else's.

## Rejected alternatives

- Keep `?report=1` per visit: never on when it mattered, which is why this ADR exists.
- A separate feedback endpoint or form: a second surface to maintain, and it would miss the
  thing that matters most, the words as the engine heard them, next to the lag rows of the
  same session.
- Tag by user agent or IP: a phone's user agent is "Android 10; K" and the IP is a NAT. Neither
  names the device, and both would tag strangers.
- Send words from everyone with a consent checkbox: the piece's intimacy is the point (ADR 0003).
