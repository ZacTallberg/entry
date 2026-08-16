from django.http import JsonResponse
from django.shortcuts import render


def home(request):
    """The FRONT DOOR — this renders THE APP, not a cloned landing (ADR-template-1)."""
    return render(request, "app/home.html", {"app_name": "entry"})


def health(request):
    return JsonResponse({"status": "ok", "app": "entry"})
