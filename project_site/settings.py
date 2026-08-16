"""Born-safe Django settings for a Greenhouse Plot (template).

Spin-up rule (ADR-template-1): a NEW app is a CLEAN Plot — its ROOT serves the app, never a cloned
landing. Do NOT clone-and-pivot an existing Plot; instantiate this template (see spinup.sh).
Security defaults are fail-closed: SECRET_KEY is required in prod, DEBUG is off unless asked, hub
writes are token-gated. Replace the entry markers via spinup.sh.
"""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
APP_NAME = "entry"           # spinup.sh sets this (the dokku app / subdomain slug)
APP_HOST = "entry.zacoberg.com"

# Dokku bind-mounts persistent storage at /app/data; the SQLite DB lives there so it survives deploys.
DATA_DIR = Path("/app/data") if Path("/app/data").is_dir() else BASE_DIR

DEBUG = os.environ.get("DEBUG", "") == "1"

# SECRET_KEY: required in prod (NO committed literal — the hub audit gate enforces this). In DEBUG,
# mint an ephemeral per-process key so local dev boots.
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "dev-ephemeral-" + secrets.token_urlsafe(32)
    else:
        raise RuntimeError("SECRET_KEY must be set in production (no insecure default).")

ALLOWED_HOSTS = [APP_HOST, "localhost", "127.0.0.1", "testserver"]
_extra = os.environ.get("ALLOWED_HOSTS", "")
if _extra:
    ALLOWED_HOSTS += [h.strip() for h in _extra.split(",") if h.strip()]

if not DEBUG:
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "app",
    "hub",  # the agent-operable /hub surface (event-sourced; renders from hub_core; token-gated writes)
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "hub.middleware.NoStoreHTMLMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "project_site.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
        "app.context.build_sha",
    ]},
}]
WSGI_APPLICATION = "project_site.wsgi.application"

DATABASES = {
    "default": {"ENGINE": "django.db.backends.sqlite3", "NAME": str(DATA_DIR / "db.sqlite3"),
                "OPTIONS": {"timeout": 20, "init_command": "PRAGMA journal_mode=WAL;"}},
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Los_Angeles"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if DEBUG
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        )
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Token for hub writes (X-Write-Token). Public reads, token-gated writes (keeps a public Plot safe).
HUB_WRITE_TOKEN = os.environ.get("HUB_WRITE_TOKEN", "")

# The Entry carries the canonical Hub cockpit as a first-class operational surface. The build
# stamp is the same artifact exposed by the public front door, keeping delivery truth coherent.
HUB_PROJECT_KEY = "entry"
HUB_BRAND = "The Entry"
HUB_BUILD_STAMP = "app/build_sha.txt"
HUB_DONE_STRICTNESS = "strict"
HUB_WORKER_LAUNCH_ENABLED = False
