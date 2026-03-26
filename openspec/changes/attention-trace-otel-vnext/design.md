## Context

The current runtime exposes execution through `LoopBusTraceEntry(step/status/detail)` records. That shape is enough for a thin spinner/log view, but it is not enough for an attention-first kernel where one unit of work can span source reads, context commits, model calls, tool calls, and message or terminal dispatch. The runtime already needs clearer cancellation semantics for `stop` vs `abort`, and Devtools needs a stable inspection contract that does not depend on private scheduler logic.

## Goals / Non-Goals

**Goals:**
- Replace ad-hoc trace entries with a span/event/link model anchored to attention-native references.
- Make model calls, tool calls, and egress dispatches traceable from the same causal chain.
- Persist and publish explicit terminal outcomes for success, error, stop, abort, and cancellation.
- Provide one canonical trace contract for Devtools and future tooling.

**Non-Goals:**
- Redesign the Devtools route itself; that belongs to `devtools-attention-first-vnext`.
- Change the semantic meaning of attention items or cycle frames; that belongs to `attention-kernel-runtime-vnext`.
- Implement external OpenTelemetry export in this change.

## Decisions

### Trace becomes span-first instead of step-string-first
The runtime will persist spans with typed attributes, child events, and explicit links to related refs. The old `step/status/detail` log format stops being the canonical inspection contract.

Why: step strings cannot represent causal links across contexts, model calls, and egress without fragile string parsing.

Alternative considered: keep the old trace array and add more metadata fields. Rejected because it still centers the wrong abstraction.

### Attention refs are the primary correlation ids
Trace spans link to attention-context refs, attention-item refs, cycle-frame refs, model-call refs, and egress refs. The trace system does not invent a second semantic identity layer.

Why: the rest of the runtime is already moving to attention-native refs; duplicating correlation ids would add translation cost.

Alternative considered: trace-only span ids with separate lookup tables. Rejected because every inspector would then need another correlation join.

### Terminal outcomes are first-class trace data
`done`, `error`, `stopped`, `aborted`, and `cancelled` are encoded as structured terminal outcomes on spans and linked model-call records.

Why: the current runtime behavior around stop/abort/model cancellation is too easy to misread from generic status strings.

Alternative considered: keep terminal outcomes only on model-call records. Rejected because non-model spans also need explicit endings.

### Publication uses snapshot plus incremental events
Clients hydrate from a bounded snapshot and then receive incremental trace events in order. The publication layer remains stable even if the in-memory tracer batches or coalesces writes.

Why: Devtools needs immediate history plus live updates without rehydrating the whole runtime on every event.

Alternative considered: publish only append-only event logs. Rejected because initial hydration would become expensive and error-prone.

## Risks / Trade-offs

- [Trace volume can grow quickly] -> Mitigation: bound retained in-memory snapshots and keep large payloads behind referenced records instead of inlining everything into every span.
- [Ref consistency matters more] -> Mitigation: create trace refs at the same boundary where cycle frames, model calls, and egress records are created.
- [Two refactors are coupled] -> Mitigation: keep the trace change dependent on the attention-native kernel records instead of inventing parallel shapes.

## Migration Plan

1. Introduce the new span/event/link record types and publication payloads.
2. Write trace spans from the current runtime around source reads, cycle scheduling, model calls, tool calls, and egress.
3. Update model-call records to carry linked trace identity and terminal outcomes.
4. Switch client-sdk and Devtools consumers to the new trace payloads.
5. Remove old LoopBus trace entry publication once all consumers read the new contract.

## Open Questions

- Whether the persisted span store should be append-only with compaction or mutable by span id.
- Whether tool-call payload previews belong inline on trace events or only via linked tool records.
