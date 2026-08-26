# Greenhouse Plot image. Built OFF-BOX (this laptop's WSL2 or the zacoberg droplet) and shipped to the
# NAS via `dokku git:from-image` (see deploy.sh / _deploy/offbox-deploy.sh). The Celeron only loads+swaps.
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PORT=5000 DJANGO_SETTINGS_MODULE=project_site.settings
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app
ARG GIT_REV=
RUN if [ -n "$GIT_REV" ]; then echo "$GIT_REV" > /app/app/build_sha.txt; fi
# Build the same hashed manifest that production resolves at request time; DEBUG would select the
# non-manifest backend and leave every `{% static %}` reference broken after release.
RUN DEBUG=0 SECRET_KEY=build python manage.py collectstatic --noinput
EXPOSE 5000
# Migrate and idempotently seed the task plane on boot, then keep the push-first Hub on one coherent
# ASGI process. Uvicorn serves product and SSE connections asynchronously; horizontal workers
# require a configured shared HUB_REALTIME_BROKER before they are safe. Secrets are injected by Dokku.
CMD sh -c "python manage.py migrate --noinput && python manage.py seedhub && exec uvicorn project_site.asgi:application --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --forwarded-allow-ips='*'"
