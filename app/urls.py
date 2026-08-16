from django.urls import path
from . import views

app_name = "app"
urlpatterns = [
    path("", views.home, name="home"),
    path("health/", views.health, name="health"),
    path("robots.txt", views.robots, name="robots"),
]
