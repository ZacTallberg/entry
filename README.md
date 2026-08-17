# The Entry

The Entry is a private-feeling public artwork at `https://entry.zacoberg.com`: write something
into the dark, feel it alter a living field, and release it without the words ever leaving the
browser.

The application is an independent Django project. Its root is the artwork; its operational plane
is the canonical `hub-scaffold` cockpit mounted at `/hub/`.

## Product contract

- Visitor text is ephemeral and browser-local. It is never submitted, stored, logged, or analyzed.
- The root remains complete with reduced motion, limited graphics, touch input, keyboard input,
  paste, and input-method editors.
- The former `https://zacoberg.com/entry/` address is a compatibility redirect, not the canonical
  application boundary.
- Hub code is vendored as whole units from `C:/code/hub-scaffold`; reusable improvements move
  upstream first and then return here as an adoption.

## Local operation

```bash
DEBUG=1 SECRET_KEY=local python manage.py migrate
DEBUG=1 SECRET_KEY=local python manage.py seedhub
DEBUG=1 SECRET_KEY=local python -m uvicorn project_site.asgi:application --host 127.0.0.1 --port 8000
```

The product is at `/`, health at `/health/`, A2A discovery at
`/.well-known/agent-card.json`, and the Hub at `/hub/`. The Hub is served through ASGI so its
persistent event stream applies canonical task and lease changes immediately. Connected means
current; Disconnected means reconnect recovery is pending. There is no polling cycle or manual
sync control.

## Operating proof

```bash
DEBUG=1 SECRET_KEY=local python -m uvicorn project_site.asgi:application --host 127.0.0.1 --port 8000
```

Use the real product and Hub paths as the default proof. Copy, style, motion, and other ordinary
changes do not receive tests. A rare critical boundary may use one transient probe that is removed
before commit; its receipt, not the probe, remains with the task. Deployment is owned by
`deploy.sh`; infrastructure and recovery details live in `PROJECT/ops/INFRA-INVENTORY.md`.
