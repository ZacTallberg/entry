web: sh -c "python manage.py migrate --noinput && exec gunicorn project_site.wsgi --bind 0.0.0.0:${PORT} --workers 2 --timeout 90 --log-file -"
