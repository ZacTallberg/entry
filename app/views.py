import json
import os
import secrets
import threading
import time

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_safe

from .context import _sha

# Content-free device diagnostics (ADR 0005): errors, capability flags, and voice-pipeline
# stage timings from real devices — never the visitor's words, transcripts, audio, or IP.
def _debug_log_path():
    """On the mount, so a deploy does not erase the device history it is being judged by."""
    mount = os.environ.get("ENTRY_ASSETS_DIR", "/app/assets")
    try:
        os.makedirs(mount, exist_ok=True)
        if os.access(mount, os.W_OK):
            return os.path.join(mount, "device-log.jsonl")
    except OSError:
        pass
    return "/tmp/entry-device-log.jsonl"


_DEBUG_LOG_PATH = _debug_log_path()
_DEBUG_LOG_MAX_BYTES = 4 * 1024 * 1024
_DEBUG_BODY_CAP = 32 * 1024
_DEBUG_EVENTS_CAP = 60


def _security_headers(response, nonce):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}' 'wasm-unsafe-eval' 'unsafe-eval'; "
        "style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob:; "
        "worker-src 'self' blob:; "
        "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    )
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=(), "
        "on-device-speech-recognition=(self)"
    )
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
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


# Server transcription (ADR 0006): the jobsite-proven engine (faster-whisper, CPU int8).
# Audio arrives as raw 16kHz float32 PCM, is transcribed IN MEMORY, and is never written,
# stored, or logged. VAD stays off — it deletes quiet speech (the jobsite lesson).
_whisper_model = None
_whisper_lock = threading.Lock()
_TRANSCRIBE_BODY_CAP = 2 * 1024 * 1024


def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        source = os.environ.get("WHISPER_MODEL_DIR") or os.environ.get("WHISPER_MODEL", "small.en")
        _whisper_model = WhisperModel(source, device="cpu", compute_type="int8")
    return _whisper_model


@csrf_exempt
@require_POST
def transcribe(request):
    if len(request.body) > _TRANSCRIBE_BODY_CAP or len(request.body) < 3200:
        return JsonResponse({"errors": [{"code": "size"}]}, status=413)
    if not _whisper_lock.acquire(timeout=20):
        return JsonResponse({"errors": [{"code": "busy"}]}, status=503)
    try:
        import numpy as np

        samples = np.frombuffer(request.body, dtype=np.float32)
        if not np.isfinite(samples).all():
            return JsonResponse({"errors": [{"code": "payload"}]}, status=400)
        model = _get_whisper()
        chunks, _info = model.transcribe(
            samples,
            language="en",
            beam_size=1,
            vad_filter=False,
            condition_on_previous_text=False,
        )
        text = " ".join(c.text.strip() for c in chunks if c.text.strip())
        response = JsonResponse({"text": text[:400]})
        response.headers["Cache-Control"] = "no-store"
        return response
    except Exception:
        return JsonResponse({"errors": [{"code": "engine"}]}, status=503)
    finally:
        _whisper_lock.release()


# The transcription assets (models + WASM runtime, ~170MB) live on a persistent mount, not in
# the image — builds stopped copying and hashing them (ADR 0007). Same URLs as before; WhiteNoise
# passes unknown /static/ paths through to this view.
_ASSETS_DIR = os.environ.get("ENTRY_ASSETS_DIR", "/app/assets")
_ASSET_TYPES = {
    ".onnx": "application/octet-stream",
    ".wasm": "application/wasm",
    ".mjs": "text/javascript; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".ort": "application/octet-stream",
    ".bin": "application/octet-stream",
}


_ASSET_BLOCK = 512 * 1024


async def _asset_blocks(full, start, length):
    """Reads happen off the event loop. A synchronous iterator handed to the ASGI
    handler is consumed inside the loop and the body is cut at an arbitrary offset,
    which silently truncated every weight file larger than a single read."""
    import asyncio

    loop = asyncio.get_running_loop()
    remaining = length
    handle = await loop.run_in_executor(None, open, full, "rb")
    try:
        if start:
            await loop.run_in_executor(None, handle.seek, start)
        while remaining > 0:
            block = await loop.run_in_executor(None, handle.read, min(_ASSET_BLOCK, remaining))
            if not block:
                break
            remaining -= len(block)
            yield block
    finally:
        await loop.run_in_executor(None, handle.close)


def _parse_range(header, size):
    if not header:
        return None
    header = header.strip()
    if not header.startswith("bytes=") or "," in header:
        return None
    first, _, last = header[6:].partition("-")
    try:
        if not first:
            if not last:
                return None
            start, end = max(0, size - int(last)), size - 1
        else:
            start = int(first)
            end = int(last) if last else size - 1
    except ValueError:
        return None
    end = min(end, size - 1)
    if start > end or start >= size:
        return None
    return start, end


@require_safe
def serve_asset(request, kind, path):
    from django.http import Http404, StreamingHttpResponse
    from django.utils._os import safe_join

    kinds = {
        "models": "models",
        "vendor/transformers": os.path.join("vendor", "transformers"),
        "vendor/moonshine": os.path.join("vendor", "moonshine"),
    }
    try:
        full = safe_join(_ASSETS_DIR, kinds[kind], path)
    except (ValueError, KeyError):
        raise Http404
    if not os.path.isfile(full):
        raise Http404
    ctype = _ASSET_TYPES.get(os.path.splitext(full)[1].lower(), "application/octet-stream")
    size = os.path.getsize(full)
    span = _parse_range(request.headers.get("Range"), size)
    start, end = span if span else (0, max(0, size - 1))
    length = 0 if not size else end - start + 1
    response = StreamingHttpResponse(
        _asset_blocks(full, start, length),
        content_type=ctype,
        status=206 if span else 200,
    )
    response.headers["Content-Length"] = str(length)
    response.headers["Accept-Ranges"] = "bytes"
    if span:
        response.headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
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
