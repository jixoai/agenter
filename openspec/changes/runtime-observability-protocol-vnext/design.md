## Context

The WebUI now presents `Contexts / Cycles / Systems / Observability`, but the server and client protocol still publish `loopbusStateLogs`, `loopbusTraces`, `runtime.loopbus.*`, and `loopbus-trace`. That means the product shell changed vocabulary while the platform contract underneath did not. The result is avoidable translation code, orphan API surface such as `modelDebug`, and a protocol that keeps teaching the wrong architecture.

## Goals / Non-Goals

**Goals:**
- Make the frontend-facing runtime publication contract scheduler/observability-first.
- Remove orphan protocol surface that no longer has a product owner, especially `modelDebug` and related client helpers.
- Keep transport inspection intact through canonical model-call and API-call records.
- Align long-history paging resource ids with the new observability contract.

**Non-Goals:**
- Rename the inner loop engine classes, plugin runtime, or storage tables in this change.
- Redesign Devtools IA again; that was handled by the Devtools attention-first change.
- Preserve `loopbus*` protocol names for backward compatibility.

## Decisions

### Public runtime protocol splits into scheduler and observability
The public runtime contract will distinguish scheduler state from runtime trace/observability data instead of flattening both into `loopbus`.

Why: scheduler state, scheduler input signals, and runtime traces serve different consumers and should not share one legacy namespace.

Alternative considered: keep `loopbus*` names internally and only alias them in WebUI. Rejected because it preserves translation cost and leaves the wrong public law in place.

### Model transport inspection keeps one fact path
Operator transport inspection will come from draft resolution, model-call records, and API-call records. The standalone `modelDebug` endpoint is removed.

Why: the WebUI no longer exposes a dedicated model-debug route, and the remaining transport facts already have canonical contracts.

Alternative considered: keep `modelDebug` as a hidden endpoint for possible future tooling. Rejected because an unowned public endpoint is protocol debt.

### Paging resources follow domain naming, not backend legacy naming
Reverse-time paging keys and load-more methods will use observability-first resource ids.

Why: paging resource ids are part of the frontend platform contract; keeping `loopbus-trace` there forces every consumer to know the legacy backend story.

Alternative considered: rename only tRPC procedures and keep `loopbus-trace` in client/UI state. Rejected because it still leaves the wrong public law in the app shell.

## Risks / Trade-offs

- [This is a breaking protocol rename across server, client, and WebUI] -> Mitigation: migrate all first-party consumers in one change and validate through targeted tests.
- [Inner engine/storage names will still say LoopBus] -> Mitigation: treat that as an explicit non-goal for this change and record it as the next refactor boundary instead of mixing layers.
- [Removing model-debug may uncover hidden consumers] -> Mitigation: audit repo references first and remove the endpoint only after all first-party consumers are gone.

## Migration Plan

1. Rename tRPC runtime procedures and realtime event names to scheduler/observability-first contracts.
2. Rename client-sdk output types, runtime-store fields, cursors, and load-more helpers to the new contract.
3. Rename WebUI paging resource ids and route consumers to the same contract.
4. Remove `modelDebug` server/client helpers and update specs/tests to use transport records as the inspection contract.
5. Validate app-server, client-sdk, and WebUI through targeted tests plus WebUI build.

## Open Questions

- Whether the later inner-engine refactor should rename `LoopBus` to `SchedulerRuntime` or collapse it more directly into an attention-runtime name.
- Whether session-db table names should be migrated in the next protocol/storage change or deferred to a storage-only migration.

## Residual Audit

Residual `loopbus*` references after this change are intentionally limited to inner engine and storage-adjacent code that stay outside the frontend-facing runtime contract:

- internal engine modules such as `loop-bus.ts`, `loopbus-kernel.ts`, and `loopbus-plugin-runtime.ts`
- inner-engine trace/status messages consumed by those modules
- internal inspection helpers such as `AppKernel.inspectModelDebug()` that remain available to server-side tests and persistence replay
- test names that still reference LoopBus as the inner runtime implementation

The public protocol boundary no longer depends on `runtime.loopbus.*`, `loopbusStateLogsBySession`, `loopbusTracesBySession`, or `loopbus-trace`. A future breaking inner-engine refactor can collapse the remaining LoopBus vocabulary into scheduler/attention-native names without reopening this frontend contract migration.
