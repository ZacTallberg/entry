# ADR-0001 — The Entry is an independent application

**Status:** accepted · **Date:** 2026-08-16

## Context

The Entry began as `/entry/` inside zacoberg.com but owns a distinct interaction model, product
identity, release cadence and operational surface.

## Decision

Its canonical origin is `https://entry.zacoberg.com`. It owns an independent repository, deployment,
project identity, event ledger and realtime Hub. The old route becomes a permanent redirect only after
the new origin is verified live.

## Consequences

The artwork evolves independently while existing links remain valid. Portfolio and operational
registries must represent it as a project, not a child page.
