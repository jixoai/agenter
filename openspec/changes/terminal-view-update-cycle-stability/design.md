## Context

We now have a focused regression signal: the Storybook DOM contract for `TerminalPanel` prints Lit's `change-in-update` warning for `terminal-view`. This means the element finishes an update while `isUpdatePending` is already true again. The most likely sources are:

- WebComponent lifecycle methods that still mutate reactive state or schedule updates while Lit is finishing an update
- initialization ordering between React host prop assignment and the WebComponent's first update
- geometry sync paths (`ResizeObserver`, xterm measurement, snapshot hydration) that bounce an immediate second update

The fix should be evidence-driven. We should not guess and leave the terminal renderer behavior drifting.

## Goals / Non-Goals

**Goals:**
- Remove the Lit `change-in-update` warning from the real browser terminal story.
- Preserve existing terminal behavior: fixed PTY geometry, fit/cover presentation, scroll contract ownership, snapshot hydration, and live transport lifecycle.
- Add a regression test that fails if the warning returns.

**Non-Goals:**
- Redesign terminal viewport metrics or xterm styling.
- Change terminal protocol or PTY sizing behavior.
- Refactor unrelated terminal panel layout concerns.

## Decisions

### Use browser evidence as the source of truth
The warning appears in Storybook Chromium, so the fix should be proven there rather than only by jsdom or mock-based unit tests.

### Treat host/init ordering and element lifecycle as one boundary
The React host and the WebComponent together define mount behavior. If the warning is caused by cross-boundary timing, the fix can live on either side, but the contract must be measured at the composed surface.

### Add a warning-free regression contract
We should explicitly assert that the terminal story renders without Lit update-cycle warnings. Otherwise this class of regression can silently reappear.

## Migration Plan

1. Instrument or isolate the terminal story path until the exact update-in-update source is known.
2. Refactor the offending lifecycle/host sync path to avoid scheduling a new update while an update is completing.
3. Add a regression assertion in terminal Storybook/browser coverage.
4. Re-run terminal-view unit tests plus WebUI terminal unit/DOM tests.
