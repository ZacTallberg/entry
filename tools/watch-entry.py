"""Stream the entry device log and report log into this session as they land.

Polls the two token-gated tails every 5 s, remembers what it has already shown in a cursor
file (so a re-armed watch does not replay), and prints one line per NEW real-device beacon:
the engine rows with their numbers, and the full text of every report-* event. Probe traffic
is skipped. Only stdout lines become notifications; transient fetch failures are swallowed.
"""
import json
import os
import re
import sys
import time
import urllib.request

BASE = "https://entry.zacoberg.com"
HERE = os.path.dirname(os.path.abspath(__file__))
CURSOR = os.path.join(HERE, "watch-entry.cursor.json")
INTERVAL = 5.0
KEEP = frozenset(["boot", "rung-a-ready", "rung-a-held", "rung-a-first", "rung-a-fast", "rung-a-slow",
                  "rung-a-unsupported", "rung-a-error", "rung-a-fail", "rung-start", "release", "perf",
                  "jserror", "rejection", "csp", "stt-native-final", "stt-server", "stt-server-fail",
                  "report-said", "report-release", "report-text", "track-mute", "track-ended",
                  "finish-text-idle", "finish-cap", "graphics-fail"])


def token():
    for line in open(r"C:\code\creds.local.txt", encoding="utf-8", errors="replace"):
        m = re.match(r"^ENTRY_HUB_WRITE_TOKEN=([0-9a-f]+)", line)
        if m:
            return m.group(1)
    raise SystemExit("no token")


TOK = token()


def fetch(path):
    req = urllib.request.Request(BASE + path, headers={
        "X-Write-Token": TOK,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) entry-watch",
    })
    with urllib.request.urlopen(req, timeout=20) as r:
        return [json.loads(l) for l in r.read().decode("utf-8").splitlines() if l.strip()]


def load_cursor():
    try:
        return set(json.load(open(CURSOR, encoding="utf-8")))
    except Exception:
        return set()


def save_cursor(seen):
    try:
        json.dump(sorted(seen)[-4000:], open(CURSOR, "w", encoding="utf-8"))
    except Exception:
        pass


def key(r):
    ev = r.get("events") or []
    return "%s|%s|%d|%s|%s" % (r.get("at"), r.get("sid"), len(ev), ev[0].get("ms") if ev else "", ev[-1].get("type") if ev else "")


def summarize(r):
    ev = r.get("events") or []
    lags = [e["ms"] for e in ev if e.get("type") == "rung-a-lag"]
    listens = [e for e in ev if e.get("type") == "listen"]
    parts = []
    for e in ev:
        t = e.get("type")
        if t in ("report-said", "report-release", "report-text"):
            parts.append("%s[%s]=%r" % (t, e.get("src", "typed" if e.get("typed") else ""), e.get("text", "")))
        elif t in KEEP:
            rest = {k: v for k, v in e.items() if k not in ("type", "ms")}
            parts.append("%s%s" % (t, (" " + json.dumps(rest, separators=(",", ":"))) if rest else ""))
    if lags:
        lags_s = sorted(lags)
        parts.append("lag n=%d med=%d p90=%d max=%d" % (len(lags), lags_s[len(lags_s) // 2], lags_s[int(len(lags_s) * 0.9)], lags_s[-1]))
    if listens:
        parts.append("listen x%d voiced=%ss peak=%s" % (len(listens), listens[-1].get("voicedSec"), max(l.get("peak", 0) for l in listens)))
    return "; ".join(parts) if parts else "(%d events: %s)" % (len(ev), ",".join(sorted({e.get("type", "?") for e in ev})))


def main():
    seen = load_cursor()
    first = not seen
    while True:
        rows = []
        for path in ("/api/debug-log/tail?n=120", "/api/debug-log/tail?src=report&n=60"):
            try:
                rows.extend(fetch(path))
            except Exception:
                pass
        fresh = []
        for r in rows:
            if r.get("probe"):
                continue
            k = key(r)
            if k in seen:
                continue
            seen.add(k)
            fresh.append(r)
        if first:
            # the first pass only seeds the cursor: everything already on the server is old news.
            # It always prints, with the newest row's age, so an armed watch is proven to see.
            first = False
            save_cursor(seen)
            newest = max((r.get("at", 0) for r in rows), default=0)
            age = "%dm" % ((time.time() - newest) / 60) if newest else "none fetched"
            sys.stdout.write("watch armed: %d rows fetched, %d new seeded, newest server row %s ago, polling every %ds\n" % (
                len(rows), len(fresh), age, INTERVAL))
            sys.stdout.flush()
        else:
            fresh.sort(key=lambda r: r.get("at", 0))
            for r in fresh:
                who = r.get("reporter") or "untagged"
                ua = r.get("ua", "")
                dev = "phone" if "Android" in ua or "iPhone" in ua else "desktop"
                sys.stdout.write("%s %s %s sid=%s %s :: %s\n" % (
                    time.strftime("%H:%M:%S", time.gmtime(r.get("at", 0))), who, dev, r.get("sid"), r.get("build"), summarize(r)))
            if fresh:
                sys.stdout.flush()
                save_cursor(seen)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
