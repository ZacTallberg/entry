"""PDX Open Mic hub HUMAN VIEW — emits the shared client-rendered app shell (hub_core.shell.render +
hub_core/frontend/). A tabbed single-file app: the kit + snapshot (#hub-data island) are inlined and
hub.js renders the Overview + per-type tables + modals client-side (UI == API; page never scrolls).
Doctrine section 8. No base.html, no 3D bundle."""
from django.http import HttpResponse

from hub_core import shell

from .hub_api import _snapshot, hub_json

BRAND = "entry · Hub"


def hub(request):
    if request.GET.get("format") == "json":
        return hub_json(request)
    _state, snap = _snapshot(request.GET.get("served"))
    return HttpResponse(shell.render(snap, BRAND))
