## Context

The previous renderer-preference and font-profile changes established the right top-level law: `rendererPreference + theme + cursor + font` are durable terminal-system truth, `resolvedRenderer` is a front-end fact, and desktop `auto` currently resolves to `ghostty-web`. The remaining failures are now inside the renderer boundary itself:

- `ghostty-web` can measure its canvas grid before the configured mono font has finished loading, which leaves the terminal looking like it is using double-width fallback spacing even though the durable font profile is correct
- `terminal-view` rebuilds a renderer session and rehydrates the current snapshot correctly at the data level, but `ghostty-web` can still stay visually blank until later PTY output arrives
- `wterm` is still useful for experimentation, but it is not yet a stable peer renderer for the primary UI surface

These are not back-end PTY or scrollbuffer problems. The transport and snapshot truth already remain stable across renderer swaps. The missing law is that canvas-first renderers must explicitly settle font metrics and visible paint after browser font loading and after local renderer rebuild.

## Goals / Non-Goals

**Goals:**
- Make `ghostty-web` and `xterm` share one stable, compact system-mono baseline by default.
- Ensure `ghostty-web` remeasures and repaints after the configured browser font becomes available.
- Ensure browser font readiness is a renderer concern instead of a host-local guess.
- Ensure `xterm -> ghostty-web` renderer swaps repaint the already-known snapshot immediately instead of waiting for future PTY output.
- Keep renderer-private settle logic inside the `ghostty-web` adapter rather than leaking it into Svelte host code.
- Mark `wterm` as experimental in the front-end config surface while keeping its adapter intact.
- Leave enough code comments and specs that the next engineer can recover why this law exists.

**Non-Goals:**
- Do not change back-end xterm/headless snapshot generation or PTY transport protocol.
- Do not redesign terminal-window fit/cover geometry in this round.
- Do not promote `wterm` to a stable default renderer.
- Do not add custom user font uploads or OS font discovery.

## Decisions

### 1. `ghostty-web` font mutation is live-settle, not rebuild-only

Decision:
- Change `ghostty-web` adapter policy so font mutations settle through `live-apply`.
- Keep theme as `rebuild-session` and cursor as `live-apply`.

Rationale:
- Upstream `ghostty-web` already supports runtime `fontFamily` / `fontSize` mutation and internally runs a font-change remeasure path.
- Rebuilding the whole renderer session for font changes is unnecessary churn and increases the chance of blank rebuild windows.

Alternative considered:
- Keep font mutations as `rebuild-session`.
- Rejected because it ignores engine capability and makes the blank-first-paint problem worse.

### 2. Font settlement belongs inside the `ghostty-web` adapter

Decision:
- Add adapter-local font-settle helpers that wait for browser font readiness when possible, then explicitly refresh `ghostty-web` font metrics and visible paint.
- The host continues to pass only the shared `font` profile.

Rationale:
- The adapter owns renderer-private timing: browser font loading, canvas remeasure, and post-open repaint are not host concerns.
- This keeps the renderer contract orthogonal: host code states what font truth is, adapter decides how that renderer must settle it.

Alternative considered:
- Put `document.fonts.ready` or repaint hacks into `terminal-view-element`.
- Rejected because it would leak `ghostty-web` specifics into the shared viewport host.

### 3. Default terminal mono stack should follow the official `ghostty-web` demo strategy first

Decision:
- Keep the durable font profile renderer-neutral, but align the shared default baseline with the official `ghostty-web` demo strategy first: a literal system monospace stack at `14px` with compact `lineHeight: 1`.
- Preserve explicit overrides such as `SF Mono` and `IBM Plex Mono` in the config surface.
- Let adapters decide which shared font subfields are actually meaningful for that renderer instead of pretending every engine consumes the exact same low-level knobs.

Rationale:
- The official `ghostty-web` README only documents `fontSize: 14`, and the upstream demo uses a literal system mono stack (`Monaco, Menlo, "Courier New", monospace`) instead of a shipped webfont-first default.
- A system mono baseline removes webfont fetch latency from the default path while still keeping optional fonts available through explicit selection.
- Our previous `JetBrains Mono Variable` + `lineHeight: 1.2` default drifted away from both the upstream demo strategy and xterm's compact default, which made `ghostty-web` look double-wide and `xterm` look vertically inflated.

Alternative considered:
- Keep the previous webfont-first baseline and continue compensating with more config fields.
- Rejected because it adds network timing to the default render path and made the abstraction claim a level of renderer equivalence that does not exist.

### 4. Rebuild hydration needs an explicit visible-paint settle step

Decision:
- After `ghostty-web` opens or is rehydrated from snapshot truth, the adapter must schedule one explicit repaint settle pass so the already-written buffer becomes visible without waiting for future PTY output.

Rationale:
- Upstream `ghostty-web` `write()` mutates buffer state, but a rebuilt renderer can still miss an immediately visible paint in our integration timing.
- This is a renderer-local visibility contract problem, not a transport truth problem.

Alternative considered:
- Keep relying on later PTY output to trigger repaint.
- Rejected because renderer rebuild must never require an operator to type a command just to see the old buffer again.

### 5. `wterm` remains available but is explicitly experimental in UI

Decision:
- Keep `wterm` in durable renderer preference and adapter support.
- Lower its front-end presentation priority and label it `Experimental`.

Rationale:
- The adapter and experiments are still valuable, especially for future web/mobile accessibility work.
- The operator-facing control should still distinguish stable paths from experimental ones.

Alternative considered:
- Remove `wterm` from the UI entirely.
- Rejected because experimentation remains an intentional product goal.

### 6. `@font-face` declaration is not renderer-ready truth

Decision:
- Treat `document.fonts.load(...)` plus a post-load settle pass as the only browser-level evidence that a renderer can trust webfont metrics.

Rationale:
- In real browser inspection, `@font-face` rules for `JetBrains Mono` were already present in loaded stylesheets while `document.fonts` still reported those faces as `unloaded`, and Network showed no font request until terminal usage or explicit `fonts.load(...)` triggered it.
- `document.fonts.check(...)` can return a matching answer before the browser has actually fetched the webfont bytes needed for canvas/grid measurement.
- Renderer hosts therefore cannot infer font readiness from stylesheet presence alone.

## Risks / Trade-offs

- [Browser font APIs are not uniform] -> Gate font readiness through feature detection and keep a requestAnimationFrame fallback.
- [Adapter settle logic could over-refresh] -> Limit extra repaint work to open, font mutation, and snapshot hydration boundaries instead of every write.
- [Default font tightening could shift visual density slightly] -> Keep explicit font overrides and validate through renderer-focused tests.
- [UI label changes can break story/e2e selectors] -> Update stable tests to select the new `WTerm (Experimental)` label.

## Migration Plan

1. Write delta specs for renderer adapter, font profile, terminal-view, and WebUI terminal surface.
2. Update `ghostty-web` adapter policy and add adapter-local font/presentation settle helpers.
3. Tighten shared default terminal font family to a shipped mono-first stack.
4. Mark `wterm` as experimental in terminal config UI and update stories/tests.
5. Add renderer adapter and `terminal-view` regressions for:
   - `ghostty-web` font live-settle
   - rebuilt-session snapshot repaint
   - `xterm -> ghostty-web` switch visibility
6. Run targeted terminal-view/WebUI verification.

## Open Questions

- Whether `ghostty-web` upstream should eventually expose a public refresh/remeasure API better than the current xterm-compatible option mutation path.
- Whether mobile/touch-specific `auto -> wterm` policy should wait until `wterm` is no longer experimental in the desktop route.
