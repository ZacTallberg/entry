from django.urls import path, re_path
from . import views

app_name = "app"
urlpatterns = [
    re_path(
        r"^static/app/(?P<kind>models|vendor/transformers)/(?P<path>.+)$",
        views.serve_asset,
        name="serve_asset",
    ),
    path("", views.home, name="home"),
    path("health/", views.health, name="health"),
    path("robots.txt", views.robots, name="robots"),
    path("api/transcribe", views.transcribe, name="transcribe"),
    path("api/debug-log", views.debug_log, name="debug_log"),
    path("api/debug-log/tail", views.debug_tail, name="debug_tail"),
]
