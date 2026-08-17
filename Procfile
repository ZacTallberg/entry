web: sh -c "python manage.py migrate --noinput && exec uvicorn project_site.asgi:application --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --forwarded-allow-ips='*'"
