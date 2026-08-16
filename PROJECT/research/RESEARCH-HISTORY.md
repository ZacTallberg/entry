# RESEARCH HISTORY — the chronicle of WHY

> canonical · owner: leader (or principal agent) · update: same session as any research/decision lands

This is the running answer to "why is the architecture what it is". Newest first. Every entry:
what question was open, what was found (keystones ⚑), and what it decided (→ ADR ids). Full detail
lives in the per-effort files in this folder; this file is the index a cold agent can actually read.

<!-- Entry format:
## YYYY-MM-DD — <question / effort title>
**Source:** <file in research/ | chat-mined | inline> · **Fed:** ADR-NNNN, gap ids
⚑ <keystone finding, one line each>
<2–5 sentences of what was learned and what it changed.>
-->

## 2026-08-16 — Standalone extraction and canonical Hub adoption

**Source:** direct source audit of `C:/code/website-dokku`, `C:/code/hub-scaffold`, sibling Hubs and
deployment configuration · **Fed:** ADR-0001, ADR-0002, ADR-0003; tasks 0001–0008

⚑ The original Entry has no model, API or stored visitor text: the entire artwork is one browser
template, so extraction should preserve the privacy boundary rather than transplant the archive app.

⚑ Its March implementation has correctness and inclusion gaps: pre-mutation key timing, uncancelled
timers, no paste/IME/mobile release path, fixed 262K-particle cost, no hidden-tab pause, no reduced-motion
or graphics fallback, runtime CDN code, and no product tests.

⚑ Every existing project instance carries an older Hub generation. The canonical `hub-scaffold` is
the only correct donor for the August realtime cockpit and interoperability surfaces.

The chosen path is a clean first-class application with Entry-owned identity and assets, browser-local
text, adaptive self-hosted rendering, an upstream-traceable Hub adoption, and an independently verified
deployment. Shared archive analytics are deliberately omitted because importing them would create a
large unrelated data and identity coupling.
