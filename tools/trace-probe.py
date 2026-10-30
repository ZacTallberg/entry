"""One dictation under a Chrome trace: every main-thread task over the threshold is listed with
what it spent its time on (script by function, layout, paint, GC) and with the page-side marks
that landed inside it (mirror rebuilds, dust syncs, long rAF gaps), so a long frame is attributed
rather than guessed at.

usage: python trace-probe.py <abs-wav> <base-url> <outdir> [seconds-of-speech] [threshold-ms]
"""
import collections
import json
import os
import sys

from playwright.sync_api import sync_playwright

wav, base, out = sys.argv[1], sys.argv[2].rstrip("/"), sys.argv[3]
speak_s = float(sys.argv[4]) if len(sys.argv) > 4 else 22
thresh = float(sys.argv[5]) if len(sys.argv) > 5 else 30
os.makedirs(out, exist_ok=True)
trace_path = os.path.join(out, "trace.json")
args = [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    f"--use-file-for-fake-audio-capture={wav}%noloop",
    "--autoplay-policy=no-user-gesture-required",
]
INIT = r"""
(() => {
  const mark = (n, d) => { try { performance.mark(n, { detail: d }); } catch (e) { performance.mark(n); } };
  let prev = 0;
  const tick = (t) => {
    if (prev && t - prev > 40) mark('gap:' + Math.round(t - prev));
    prev = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener('DOMContentLoaded', () => {
    const m = document.getElementById('dictation-mirror');
    if (!m) return;
    new MutationObserver(() => mark('mirror:' + m.querySelectorAll('.w').length)).observe(m, { childList: true, subtree: true });
  });
})();
"""
extra = os.environ.get("EXTRA", "")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=args)
    ctx = browser.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.add_init_script(INIT)
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:160]))
    page.goto(f"{base}/?stt=tiny{extra}", wait_until="domcontentloaded")
    page.wait_for_selector("#speak:not([hidden])", timeout=60000)
    try:
        page.wait_for_selector('#speak[data-loading="false"]', timeout=120000)
    except Exception:
        pass
    page.wait_for_timeout(1500)
    browser.start_tracing(page=page, path=trace_path, categories=[
        "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame",
        "v8.execute", "blink.user_timing", "disabled-by-default-v8.gc",
    ])
    page.click("#speak")
    page.wait_for_timeout(int(speak_s * 1000))
    if page.evaluate("document.body.dataset.voiceOn") == "true":
        page.click("#speak")
    state = ""
    for _ in range(300):
        page.wait_for_timeout(100)
        state = page.evaluate("document.body.dataset.state || ''")
        if state == "releasing":
            break
    page.wait_for_timeout(4000)
    browser.stop_tracing()
    perf = page.evaluate("window.entryExperience && window.entryExperience.perf ? JSON.stringify(window.entryExperience.perf()) : ''")
    fxc = page.evaluate("JSON.stringify(window.__fx || {})") + " stt:" + page.evaluate("JSON.stringify(window.__stt ? {passes: window.__stt.passes, lags: window.__stt.lags.length, slow: window.__stt.slow, fast: window.__stt.fast, tier: window.__stt.tier, place: window.__stt.place} : {})")
    words = page.evaluate("document.getElementById('entry-text') ? document.getElementById('entry-text').value : ''")
    ctx.close()
    browser.close()

print("perf:", perf, "| fx:", fxc, "| errors:", errs[:3])
print("text:", words[:200])

ev = json.load(open(trace_path, encoding="utf-8"))
events = ev["traceEvents"] if isinstance(ev, dict) else ev
# the page's main thread is the one with the most top-level tasks
by_thread = collections.Counter()
for e in events:
    if e.get("ph") == "X" and e.get("name") in ("RunTask", "ThreadControllerImpl::RunTask"):
        by_thread[(e["pid"], e["tid"])] += 1
(pid, tid), _n = by_thread.most_common(1)[0]
main = [e for e in events if e.get("pid") == pid and e.get("tid") == tid]
xs = sorted((e for e in main if e.get("ph") == "X" and "dur" in e), key=lambda e: (e["ts"], -e["dur"]))
marks = [e for e in main if e.get("ph") in ("R", "I", "i") and e.get("cat", "").find("user_timing") >= 0]
tasks = [e for e in xs if e["name"] in ("RunTask", "ThreadControllerImpl::RunTask") and e["dur"] >= thresh * 1000]


def label(e):
    d = (e.get("args") or {}).get("data") or {}
    n = e["name"]
    if n == "FunctionCall":
        return "fn:%s@%s:%s" % (d.get("functionName", "?"), (d.get("url", "") or "").rsplit("/", 1)[-1], d.get("lineNumber", "?"))
    if n == "EventDispatch":
        return "event:%s" % d.get("type", "?")
    if n == "TimerFire":
        return "timer"
    if n == "v8.compile":
        return "compile:%s" % (d.get("url", "") or "").rsplit("/", 1)[-1]
    return n


t0 = xs[0]["ts"] if xs else 0
print("\nmain thread pid=%d tid=%d; %d tasks >= %dms (of %d)" % (pid, tid, len(tasks), thresh, sum(1 for e in xs if e["name"] in ("RunTask", "ThreadControllerImpl::RunTask"))))
hist = collections.Counter()
for ti, t in enumerate(tasks):
    s, d = t["ts"], t["dur"]
    inner = [e for e in xs if e["ts"] >= s and e["ts"] + e["dur"] <= s + d and e is not t]
    # self time per name: an event's time minus its own children's
    selfs = collections.Counter()
    for i, e in enumerate(inner):
        kids = sum(k["dur"] for k in inner if k["ts"] >= e["ts"] and k["ts"] + k["dur"] <= e["ts"] + e["dur"] and k is not e and k["dur"] < e["dur"])
        selfs[label(e)] += max(0, e["dur"] - kids)
    top = ", ".join("%s %dms" % (k, v / 1000) for k, v in selfs.most_common(6) if v >= 1000)
    inside = [m["name"] for m in marks if s <= m["ts"] <= s + d]
    if ti < int(os.environ.get("SHOW", "30")):
        print("  +%6.2fs  %4dms  %s  | marks: %s" % ((s - t0) / 1e6, d / 1000, top, " ".join(inside[:6])))
    for k, v in selfs.items():
        hist[k] += v
print("\nself time across the long tasks:")
for k, v in hist.most_common(14):
    print("  %6dms  %s" % (v / 1000, k))
gaps = sorted((int(m["name"][4:]) for m in marks if m["name"].startswith("gap:")), reverse=True)
print("\nrAF gaps > 40ms: %d; worst %s" % (len(gaps), gaps[:8]))
