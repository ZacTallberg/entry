"""URL routing — the ROOT serves the APP (ADR-template-1: never a cloned landing).

The hub (project tracking) lives at /hub, NEVER at the front door.
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("app.urls")),          # the FRONT DOOR is the app itself
    path("hub/", include("hub.urls")),       # agent-operable hub at /hub (event-sourced, hub_core)
]
