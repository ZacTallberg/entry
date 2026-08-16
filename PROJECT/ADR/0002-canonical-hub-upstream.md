# ADR-0002 — hub-scaffold is the direct upstream

**Status:** accepted · **Date:** 2026-08-16

## Context

The sanctioned project generator carries an older Hub generation. Canonical hub-scaffold contains
the current realtime cockpit, event semantics, delivery truth and agent interoperability surfaces.

## Decision

Vendor the engine, Django adapter, schemas and frontend from canonical hub-scaffold as whole units.
Product code stays outside those units. Reusable corrections discovered here land upstream first.

## Consequences

The Entry receives current capabilities without becoming another fork. Adoption provenance must name
the upstream commit and conformance must be re-run after every adoption.
