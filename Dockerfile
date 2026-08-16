# Greenhouse Plot image. Built OFF-BOX (this laptop's WSL2 or the zacoberg droplet) and shipped to the
# NAS via `dokku git:from-image` (see deploy.sh / _deploy/offbox-deploy.sh). The Celeron only loads+swaps.
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PORT=5000 DJANGO_SETTINGS_MODULE=project_site.settings
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app
# collectstatic at build (SECRET_KEY not needed for it under DEBUG); whitenoise serves /static.
RUN DEBUG=1 SECRET_KEY=build python manage.py collectstatic --noinput
EXPOSE 5000
# migrate ON BOOT guarantees the tables exist (prevents the `no such table` outage), THEN gunicorn.
# SECRET_KEY / ALLOWED_HOSTS injected by dokku config (fail-closed).
CMD sh -c "python manage.py migrate --noinput && exec gunicorn project_site.wsgi --bind 0.0.0.0:${PORT} --workers 2 --timeout 90 --log-file -"
