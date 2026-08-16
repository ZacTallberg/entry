# ADR-0003 — Visitor words remain ephemeral

**Status:** accepted · **Date:** 2026-08-16

## Context

The artwork's intimacy depends on release rather than publication. Its original implementation never
submitted the textarea; unrelated parent-site analytics were the only server coupling.

## Decision

Visitor text remains exclusively in browser memory. It is never sent, logged, persisted, analyzed,
indexed or included in telemetry. Only content-free service health may be observed.

## Consequences

There is no message corpus, moderation queue or recovery mechanism. Tests and live review must prove
the absence of content-bearing requests before the privacy promise is rendered as fact.
