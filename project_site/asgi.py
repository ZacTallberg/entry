import os
from django.core.asgi import get_asgi_application
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "project_site.settings")
application = get_asgi_application()

# Warm the ledger fold and the board snapshot once, on a daemon thread, in the SERVED process
# only (never in tests or management commands). Requests are not blocked; HUB_PREWARM=0 disables it.
from hub import prewarm  # noqa: E402

prewarm.start()
