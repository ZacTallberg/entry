# 0008 — Large responses stream unbuffered, and the client verifies what it received

- Status: accepted
- Date: 2026-08-27

## Context

Voice was dead on production for hours while every local and offbox check looked healthy. The
symptom was that model weights never finished downloading: `frontend.ort` advertised
`Content-Length: 8324920` and delivered 4,879,854 bytes, then 2,811,126, then 2,972,742 — a
different cut every attempt. Files under ~1.4MB always arrived whole. Chrome reported
`ERR_QUIC_PROTOCOL_ERROR`, which pointed at the transport and cost most of the debugging time;
forcing HTTP/1.1 truncated identically, which cleared QUIC.

Three diagnoses were wrong before the right one. Two are worth recording because each looked
convincing: a 90MB legacy preload colliding with the streaming download (real, fixed in 1628a9b,
not the cause), and Django's ASGI warning `StreamingHttpResponse must consume synchronous
iterators` (present on every request, and a control serving the same 40MB file through the
identical `FileResponse` construction delivered all 41,943,040 bytes — so the warning is noise).

The origin's own nginx error log named the cause:

```
[crit] open() "/var/lib/nginx/proxy/8/07/0000000078" failed (13: Permission denied)
       while reading upstream ... /static/app/models/tiny-streaming-en/frontend.ort
```

nginx proxies with buffering on and only 8×4k of memory buffers. Any response it cannot hand to
the client as fast as the app produces it spills to a temp file; that directory is not writable, so
nginx abandoned the body mid-stream while the client had already been promised the full length.
Small files fit in memory and were never affected — which is exactly the size threshold observed,
and why the cut offset varied with client speed.

## Decision

- `nginx:set entry proxy-buffering off` on the host. nginx streams upstream to client directly and
  never needs a temp file. This is host state, not repo state: it survives deploys in dokku's app
  config but is invisible to the tree, so it is recorded here and in the deploy atlas.
- `serve_asset` yields blocks from a thread instead of handing the ASGI handler a blocking file
  object, and honours `Range` with a real `206`/`Content-Range`. Range support is what makes a short
  read repairable rather than fatal.
- The weights are served by this view and not by a boot-time symlink into `staticfiles`. WhiteNoise
  indexes its files at startup, so anything `pullasset` fetches later would be invisible until a
  restart; the view always reflects the mount.
- The client stops trusting the transport. `fetchWhole` measures every model file against the
  length the server declared and re-requests any shortfall by range before the engine sees a byte.
  A file that cannot be completed falls back to a direct URL rather than refusing to start.

**Amendment (2026-08-27):** the client-side repair is withdrawn. Handing the loader `blob:` URLs
broke it outright — the engine stores its weights in Cache Storage and `cache.put()` rejects a blob
request scheme (`rung-a-fail: Request scheme 'blob' is unsupported`), so 6ca3e10 shipped a working
transport with a dead engine and fell through to the retired legacy rung. That cache is also what
spares a returning visitor the fifty-megabyte download, so intercepting the fetch was wrong twice.
The engine fetches the real URLs itself; what remains client-side is `auditDelivery()`, which on a
load failure asks each file whether it is reachable and whether the server can still hand over its
final bytes, and reports that alongside the error. Range support on the server is what makes that
audit possible and stays. Caught by the behavioural prod check, not by any status-code green.

## Consequences

- All seven files now deliver complete, including the 32,583,720-byte decoder, and prod voice
  produces a live revising transcript (verified in a real browser with a synthetic microphone).
- Unbuffered proxying ties an upstream worker to a slow client for the length of the download. The
  app is one uvicorn process, so a handful of concurrent cold loads on bad connections is the new
  pressure point to watch. SSE (`/hub/live/events`) benefits — it was logging
  `upstream prematurely closed` under buffering.
- The temp-directory permission is a host-level defect affecting every app on that box, not just
  this one. Fixing it needs root; per-app `proxy-buffering off` is the available remedy and any
  sibling app serving responses above a few hundred kilobytes is presumed affected until checked.
- A declared `Content-Length` is now treated as a claim to verify, not a fact. The class of bug —
  a 200 with an honest header and a dishonest body — defeats status-code and header checks alike.
