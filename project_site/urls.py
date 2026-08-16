"""URL routing — the ROOT serves the APP (ADR-template-1: never a cloned landing).

The hub (project tracking) lives at /hub, NEVER at the front door.
"""
from django.contrib import admin
from django.urls import include, path

from hub.agent_card import agent_card_view

urlpatterns = [
    path("admin/", admin.site.urls),
    path(".well-known/agent-card.json", agent_card_view),
    path("", include("app.urls")),          # the FRONT DOOR is the app itself
    path("hub/", include("hub.urls")),       # agent-operable hub at /hub (event-sourced, hub_core)
]
