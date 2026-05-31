## Context

`loopbus-attention-first-plugin-pipeline` introduces the backend contract, but the migration is incomplete until client-sdk and WebUI stop depending on the legacy single-focus and diff-only assumptions. The user requirement is broader than backend correctness: the app surface should make the new terminal contract obvious and stable, with minimal compatibility shims.

Existing code already has relevant integration points:
- runtime snapshots carry both `focusedTerminalId` and `focusedTerminalIds`
- client-sdk runtime store normalizes incoming payloads
- WebUI terminal/devtools panels consume runtime store state
- Storybook DOM is already the preferred WebUI contract-test layer

The missing work is contract propagation and consumer cleanup.

## Goals / Non-Goals

**Goals:**
- Make `focusedTerminalIds` the primary contract from runtime through client-sdk to WebUI.
- Propagate explicit terminal read representation metadata so consumers can render diff vs snapshot intentionally.
- Remove consumer dependence on legacy terminal tool names and backend-only compatibility hacks.
- Add regression coverage at the runtime-store and WebUI DOM-contract layers.

**Non-Goals:**
- Implement the standalone `terminal-view` renderer package itself.
- Rework unrelated WebUI shell/navigation behavior.
- Remove every compatibility field immediately if active consumers still require a deprecation window.

## Decisions

### Prefer focused terminal sets end-to-end
`focusedTerminalIds` becomes the contract every consumer should follow; `focusedTerminalId` survives only as a derived compatibility projection during migration.

Why: the backend now supports multiple focused terminals, so client surfaces must stop centering the old single-focus mental model.

### Representation metadata travels with terminal reads
Whenever a terminal read/snapshot payload enters runtime or UI state, its representation kind remains explicit.

Why: consumers should not infer diff vs snapshot from payload shape alone.

### WebUI verification uses Storybook DOM where interaction matters
Terminal/devtools surface changes should be covered with Storybook DOM contract tests instead of only mocked jsdom snapshots.

Why: terminal panels and tool views are exactly the kind of composite UI that benefits from real DOM behavior.

## Risks / Trade-offs

- [Compatibility drift] -> keeping derived compatibility fields too long can slow cleanup; mark the primary contract explicitly in types and adapters.
- [UI regressions] -> terminal/devtools panels may rely on old assumptions about one focused terminal; cover selection and scrolling behavior with DOM tests.
- [Event churn] -> realtime payload changes can ripple through store reducers; keep event schemas explicit and type-safe.

## Migration Plan

1. Define runtime/client/webui contract specs.
2. Update app-server realtime payloads and snapshot shapes.
3. Update client-sdk runtime-store normalization and selectors.
4. Update WebUI terminal/devtools consumers and add Storybook DOM tests.
5. Retire leftover compatibility-only logic once all consumers are migrated.

## Dependencies and Handoff

**Inbound dependencies:**
- Depends on `refactor-loopbus-attention-runtime` for the runtime publication contract.
- Depends on `modernize-terminal-control-plane` for canonical terminal payload semantics.

**Outbound handoff:**
- `extract-terminal-view-webcomponent` consumes the cleaned-up WebUI host contract produced here.

**Implementation boundary:**
- This change owns runtime payload propagation, client-sdk normalization, and WebUI consumer migration.
- It does not own backend terminal lifecycle APIs or the standalone renderer package.
