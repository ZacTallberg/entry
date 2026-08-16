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
DEBUG=1 SECRET_KEY=local python manage.py runserver
```

The product is at `/`, health at `/health/`, A2A discovery at
`/.well-known/agent-card.json`, and the Hub at `/hub/`.

## Verification

```bash
DEBUG=1 SECRET_KEY=gate python manage.py check
DEBUG=1 SECRET_KEY=gate python manage.py test
DEBUG=1 SECRET_KEY=gate python manage.py hubaudit
```

Deployment is owned by `deploy.sh`; infrastructure and recovery details live in
`PROJECT/ops/INFRA-INVENTORY.md`.
