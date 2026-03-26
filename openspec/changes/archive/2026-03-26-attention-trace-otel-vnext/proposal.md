## Why

Even with attention primitives in place, the runtime still exposes execution as ad-hoc `LoopBusTraceEntry(step/status/detail)` records. That is too weak for an attention-first kernel: it cannot express linked work across contexts, model calls, egress dispatches, cancellations, or future system integrations in a way that remains inspectable, queryable, and stable.

## What Changes

- **BREAKING** replace the current LoopBus trace shape with an OpenTelemetry-style trace model built around spans, events, links, and stable attention references.
- Introduce attention-native trace records for source reads, attention transforms, cycle scheduling, model calls, tool calls, and egress dispatches.
- Link trace spans to `attention-context`, `attention-item`, cycle-frame, model-call, and external-effect records so the kernel can be inspected without reconstructing private runtime state.
- Record stop vs abort vs model cancellation explicitly so trace consumers can distinguish scheduler halt, model abort, and runtime teardown.
- Publish the new trace model as the canonical inspection contract for Devtools and other advanced tooling.

## Capabilities

### New Capabilities
- `attention-trace-spans`: OpenTelemetry-style trace spans, events, and links for attention-native runtime execution.
- `attention-trace-publication`: stable runtime publication of trace snapshots and incremental trace events keyed by attention refs.

### Modified Capabilities
- `model-call-lifecycle`: model calls now expose linked trace identity and explicit cancellation/termination outcomes.
- `loopbus-runtime-publication`: the published runtime inspection contract moves from LoopBus-centric traces to attention-native trace and frame references.

## Impact

- Affected code: `packages/app-server/src/loop-bus.ts`, `packages/app-server/src/agent-runtime.ts`, `packages/app-server/src/session-runtime.ts`, `packages/client-sdk`, `packages/webui` Devtools trace consumers.
- Affected data: persisted trace rows, in-memory runtime trace snapshots, model-call metadata, and cycle-to-trace linking.
- Affected APIs: runtime snapshot streams, Devtools trace subscriptions, model-call inspection payloads.
- Supersedes the trace direction implied by `loopbus-attention-io-pipeline` and the current `loopbus-runtime-publication` contract.
