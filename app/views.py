import secrets

from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_safe

from .context import _sha


def _security_headers(response, nonce):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}'; "
        "style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; "
        "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    )
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()"
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


@require_safe
def robots(request):
    body = "\n".join([
        "User-agent: GPTBot", "Disallow: /", "",
        "User-agent: ClaudeBot", "Disallow: /", "",
        "User-agent: Google-Extended", "Disallow: /", "",
        "User-agent: *", "Allow: /", "Disallow: /hub/", "Disallow: /admin/", "",
    ])
    return HttpResponse(body, content_type="text/plain; charset=utf-8")
