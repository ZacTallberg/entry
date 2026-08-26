from django.urls import path
from . import views

app_name = "app"
urlpatterns = [
    path("", views.home, name="home"),
    path("health/", views.health, name="health"),
    path("robots.txt", views.robots, name="robots"),
    path("api/debug-log", views.debug_log, name="debug_log"),
    path("api/debug-log/tail", views.debug_tail, name="debug_tail"),
]
