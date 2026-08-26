import json
import os
import secrets
import time

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_safe

from .context import _sha

# Content-free device diagnostics (ADR 0005): errors, capability flags, and voice-pipeline
# stage timings from real devices — never the visitor's words, transcripts, audio, or IP.
_DEBUG_LOG_PATH = "/tmp/entry-device-log.jsonl"
_DEBUG_LOG_MAX_BYTES = 4 * 1024 * 1024
_DEBUG_BODY_CAP = 32 * 1024
_DEBUG_EVENTS_CAP = 60


def _security_headers(response, nonce):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}' 'wasm-unsafe-eval'; "
        "style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
        "worker-src 'self'; "
        "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    )
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()"
    )
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    return response


@require_safe
def home(request):
    nonce = secrets.token_urlsafe(18)
    response = render(request, "app/home.html", {"csp_nonce": nonce})
    return _security_headers(response, nonce)


@require_safe
def health(request):
    response = JsonResponse({"status": "ok", "app": "entry", "build": _sha()})
    response.headers["Cache-Control"] = "no-store"
    return response


def _rotate_debug_log():
    try:
        if os.path.getsize(_DEBUG_LOG_PATH) <= _DEBUG_LOG_MAX_BYTES:
            return
        with open(_DEBUG_LOG_PATH, "rb") as f:
            f.seek(-_DEBUG_LOG_MAX_BYTES // 2, os.SEEK_END)
            tail = f.read()
        tail = tail[tail.find(b"\n") + 1:]
        with open(_DEBUG_LOG_PATH, "wb") as f:
            f.write(tail)
    except OSError:
        pass


@csrf_exempt
@require_POST
def debug_log(request):
    try:
        body = request.body[:_DEBUG_BODY_CAP]
        payload = json.loads(body)
        events = payload.get("events")
        if not isinstance(events, list):
            raise ValueError
        record = {
            "at": int(time.time()),
            "sid": str(payload.get("sid", ""))[:16],
            "build": str(payload.get("build", ""))[:24],
            "probe": bool(payload.get("probe")),
            "ua": request.headers.get("User-Agent", "")[:200],
            "events": events[:_DEBUG_EVENTS_CAP],
        }
        line = json.dumps(record, separators=(",", ":"))[:_DEBUG_BODY_CAP] + "\n"
        with open(_DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line)
        _rotate_debug_log()
    except (ValueError, OSError, UnicodeDecodeError):
        pass
    response = HttpResponse(status=204)
    response.headers["Cache-Control"] = "no-store"
    return response


@require_safe
def debug_tail(request):
    want = settings.HUB_WRITE_TOKEN
    got = request.headers.get("X-Write-Token", "")
    if not want or not secrets.compare_digest(want, got):
        return JsonResponse({"errors": [{"code": "auth"}]}, status=401)
    try:
        n = max(1, min(1000, int(request.GET.get("n", 200))))
    except ValueError:
        n = 200
    lines = []
    try:
        with open(_DEBUG_LOG_PATH, encoding="utf-8", errors="replace") as f:
            lines = f.readlines()[-n:]
    except OSError:
        pass
    response = HttpResponse("".join(lines), content_type="application/x-ndjson; charset=utf-8")
    response.headers["Cache-Control"] = "no-store"
    return response


@require_safe
def robots(request):
    body = "\n".join([
        "User-agent: GPTBot", "Disallow: /", "",
        "User-agent: ClaudeBot", "Disallow: /", "",
        "User-agent: Google-Extended", "Disallow: /", "",
        "User-agent: *", "Allow: /", "Disallow: /hub/", "Disallow: /admin/", "",
    ])
    return HttpResponse(body, content_type="text/plain; charset=utf-8")
