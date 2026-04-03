## Context

The current system-surface stack composes three layers:

- `web-chat-view` owns room transcript state and transport hydration.
- `AsyncSurface` owns shared async-state presentation.
- `ToolInvocationCard` owns structured technical fact rendering.

All three regressions came from contract drift inside these shared layers rather than from feature-local code.

## Goals / Non-Goals

**Goals**

- Make empty room snapshots a first-class resolved state in `web-chat-view`.
- Keep async-state slots mutually exclusive in the rendered DOM.
- Keep terminal activity readable for operators and exact enough for BDD assertions.

**Non-Goals**

- Redesign message-system transport.
- Change terminal activity data persistence or tool payload schemas.
- Introduce a second async-state abstraction.

## Decisions

### `web-chat-view` gets an explicit empty-snapshot resolution signal

`initialMessages.length === 0` is not enough to distinguish “no history yet” from “history not loaded yet”. The host now passes `initialSnapshotResolved`, and the root transcript state machine clears its first-load state when an empty snapshot has already been resolved by the host.

### `AsyncSurface` wrapper renders one state payload at a time

The Lit element already models one active state, but the Svelte wrapper previously mounted `empty`, `skeleton`, and default children together as light DOM. The wrapper now mirrors the state machine and only provides the slot tree that matches the current async state.

### Terminal action cards keep two title layers

Terminal activity cards now render a visible human title from `meta.title` when available, while keeping the raw tool id as secondary metadata. This preserves operator readability and keeps the structured invocation contract intact.

## Risks / Trade-offs

- `web-chat-view` now depends on a host-supplied resolution flag for empty initial history, so host adapters must pass the correct loaded state.
- `AsyncSurface` callers that implicitly relied on hidden inactive slot DOM will lose that accidental behavior; this is intentional because it violated the async-state contract.
- Terminal cards now show one extra metadata line when a friendly title exists, which slightly increases vertical density in exchange for readability and test stability.

## Verification Plan

1. Add package-level regression tests for empty resolved room snapshots and visible invocation titles.
2. Run `pnpm --filter @agenter/web-components test`.
3. Run `pnpm --filter @agenter/web-chat-view test`.
4. Run `pnpm --filter @agenter/webui typecheck`.
5. Run WebUI BDD regression and then desktop + iPhone 14 browser dogfooding.
