## Why

Even after the runtime loop is contained, the product still pays too much memory and interaction cost because performance fixes are fragmented across one-off traces, per-panel loading shells, ad-hoc list state, and unstable heavy renderers. We need one explicit platform change that turns performance from anecdotal complaint handling into shared contracts, shared tools, and repeatable verification.

## What Changes

- Add a new runtime performance diagnostics capability that exposes lightweight publication, hydration, render, and memory counters for real browser and real runtime investigation.
- Extend session history and client runtime-store contracts so long-lived technical surfaces share one bounded reverse-time window model instead of hydrating unbounded lists into memory.
- Extend runtime UI publication so active surfaces subscribe only to visible heavy slices and diagnostics can prove when selector results are or are not being republished.
- Extend async surface primitives so long-list panels reuse one four-state loading model plus shared pagination affordances instead of hand-rolled loading shells.
- Extend the WebUI render-performance guard from shell chrome to heavy inspectors, structured viewers, and long-list technical routes, with stable renderer identity as an explicit contract.
- **BREAKING** remove ad-hoc per-panel performance logic, bespoke list loading shells, and implicit “just profile it manually” workflows in favor of shared primitives and shared diagnostics.

## Capabilities

### New Capabilities
- `runtime-performance-diagnostics`: shared performance counters, evidence capture, and regression workflow for runtime and WebUI performance analysis.

### Modified Capabilities
- `session-history-pagination`: long-history technical resources share one reverse-time envelope suitable for paged virtualized surfaces.
- `client-runtime-store`: the runtime store keeps bounded resource windows and shared long-list controller state instead of accumulating unbounded in-memory history.
- `runtime-ui-publication`: runtime publication exposes visibility-scoped subscriptions and diagnostic counters for hot-slice churn.
- `async-surface-states`: fetch-driven long-list panels reuse one shared loading and pagination treatment.
- `webui-render-performance-guard`: render-performance contracts cover heavy structured viewers and technical long lists, not only shell chrome.

## Impact

- Affected code spans `packages/app-server`, `packages/client-sdk`, `packages/webui`, Storybook/Vitest DOM tests, and browser walkthrough tooling.
- Affected behavior includes list hydration, pagination state, runtime publication diagnostics, structured viewer stability, and route-level loading treatments across Chat, Cycles, Terminal Activity, Loop/Attention tooling, and related technical panels.
- This change establishes the repository’s default performance methodology: diagnose with shared counters and browser evidence first, then optimize against shared contracts instead of panel-specific folklore.
