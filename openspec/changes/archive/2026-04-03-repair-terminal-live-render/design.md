## Context

The terminal route already mounts the shared `TerminalViewHost`, but the page can still render blank after refresh even while the terminal is running. That points to a projection problem between terminal-system, app-server payloads, client-runtime-store normalization, and route consumption rather than a defect in the terminal-view leaf component alone. Current story coverage also leans on a snapshot harness instead of the same live host contract used by the real route, which weakens regression detection.

## Goals / Non-Goals

**Goals:**
- Keep global terminal entries renderable after refresh using one normalized terminal truth.
- Preserve render-critical facts such as snapshot, transport URL, renderer engine, and absolute cwd across hydration and live updates.
- Ensure route-level mutations immediately update the same live state model used by the terminal page.
- Align tests and harnesses with the real shared terminal view host path.

**Non-Goals:**
- Redesign terminal collaboration policy or approval semantics.
- Replace the shared `terminal-view` component with a route-local renderer.
- Introduce session-private terminal routing as a fallback for global terminals.

## Decisions

### 1. Treat global terminal entries as renderable control-plane facts

The global terminal catalog payload will be treated as a renderable projection, not just list metadata. Route consumers must be able to render the selected terminal from the normalized `GlobalTerminalEntry` alone, including snapshot, absolute cwd, renderer metadata, and transport URL.

Why:
- Refresh should not require a second hidden data source before a running terminal becomes visible.
- The backend already knows enough to describe a renderable terminal entry.

Alternative rejected:
- Keep the catalog lightweight and make the route fetch a separate ad hoc terminal snapshot. That adds another authority path and recreates refresh drift.

### 2. Runtime-store reconciliation must merge terminal facts instead of dropping them

`client-runtime-store` will reconcile global terminal entries so refresh hydration and incremental updates preserve render-critical fields unless a newer explicit value replaces them. Live activity, grant changes, and seat changes must not accidentally strip snapshot or transport data from the selected terminal projection.

Why:
- Route emptiness after refresh is usually caused by projection loss, not terminal absence.
- The store is the correct place to preserve a stable normalized terminal truth.

Alternative rejected:
- Patch blank states only inside `terminals-route`. That would hide symptoms while leaving shared state incoherent for other consumers.

### 3. Keep terminal-view hydration and live transport in one host contract

`TerminalViewHost` and the shared `terminal-view` component will continue to represent one terminal with two data phases:
- immediate snapshot hydration
- live websocket transport takeover

The component must not clear a usable snapshot while waiting for live transport.

Why:
- Snapshot and websocket are two phases of one terminal identity.
- The terminal page should remain visually stable during reconnects and reloads.

Alternative rejected:
- Treat snapshot mode and live mode as separate host implementations. That increases divergence and makes route regressions harder to detect.

### 4. Route verification must use the same live host path as production

Terminal route stories and regression tests will exercise `TerminalViewHost` or an equivalent contract-faithful harness instead of the old snapshot-only fallback.

Why:
- A test harness that bypasses the real host path can pass while the real page still fails.
- Shared terminal rendering is a contract, not a mock detail.

Alternative rejected:
- Keep snapshot-only story coverage. It is cheaper but it does not validate the real failure mode the user is seeing.

## Risks / Trade-offs

- [Hydration merge bugs] Merging normalized terminal fields incorrectly can preserve stale data. → Mitigation: define merge precedence explicitly and add targeted store tests.
- [Live/snapshot race] A late snapshot could overwrite newer live render state. → Mitigation: keep existing seq-based freshness rules and only hydrate when incoming data is newer or live transport is absent.
- [Test complexity] Route-level terminal tests are heavier than leaf tests. → Mitigation: keep store-unit tests focused and reserve DOM/browser coverage for the critical refresh/render story.

## Migration Plan

1. Inspect and patch backend terminal entry projection if any render-critical field is missing.
2. Update client-runtime-store terminal reconciliation to preserve snapshot, transport URL, renderer engine, and absolute cwd across refresh and live events.
3. Patch terminal route consumers so call-as options and selected terminal view derive directly from normalized live state.
4. Update shared terminal host behavior if needed so snapshot hydration remains visible until live transport supersedes it.
5. Replace snapshot-only route harness assumptions with contract-faithful regression coverage.

## Open Questions

- None. The next step is evidence-driven implementation through the control-plane → client-store → route chain.
