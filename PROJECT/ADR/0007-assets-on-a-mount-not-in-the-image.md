# 0007 — Transcription assets live on a mount, not in the image

- Status: accepted
- Date: 2026-08-25

## Context

The voice arc added ~170MB of ONNX weights and WASM runtime to the repo and image. Every deploy
cloned, copied, hashed, and gzipped them on a Celeron; build times grew past ten minutes while the
operator iterated live. The assets change on a different cadence than code — months, not minutes.

## Decision

- `app/static/app/models/**` and `app/static/app/vendor/transformers/**` are gitignored and left
  out of the image. They live on the dokku mount `entry-assets:/app/assets` (populated once via
  `dokku run` from the last fat image; refreshed by the same route when models change).
- The same URLs keep working: WhiteNoise passes unknown `/static/` paths through to Django, where
  `serve_asset` reads the mount with immutable cache headers. Local dev is unaffected — the files
  stay on disk in the working tree and runserver's staticfiles handler serves them first.
- The server-side whisper model bake stays in the Dockerfile: it is its own cached layer and only
  rebuilds when requirements change.

## Consequences

- Deploys carry code only; the build-critical path is the pip layer (cached) + a small COPY +
  collectstatic over real app static.
- A fresh clone of the repo does not contain the assets: local voice dev on a new machine needs
  them fetched once (HuggingFace `onnx-community/moonshine-*-ONNX`, transformers.js npm dist) or
  copied from the mount/backup.
- The mount is a new backup surface: `/var/lib/dokku/data/storage/entry-assets` (recoverable from
  HF + npm upstreams, so mirror-priority is low but nonzero).
