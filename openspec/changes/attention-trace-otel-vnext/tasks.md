## 1. Trace model and storage

- [x] 1.1 Define the span, event, link, and terminal-outcome records for attention-native runtime tracing.
- [x] 1.2 Implement trace creation and persistence around source reads, attention commits, cycle scheduling, model calls, tool calls, and egress dispatches.
- [x] 1.3 Add snapshot plus incremental publication for trace hydration and live inspection.

## 2. Model-call and cancellation integration

- [x] 2.1 Link model-call records to trace refs at request start, completion, failure, and cancellation.
- [x] 2.2 Encode explicit stop, abort, timeout, and cancel outcomes in trace spans and linked model-call records.
- [x] 2.3 Retire the old `LoopBusTraceEntry(step/status/detail)` publication path once all trace consumers use the new contract.

## 3. Consumer updates and verification

- [x] 3.1 Update client-sdk and WebUI consumers to read attention-native trace snapshots and events.
- [x] 3.2 Add integration tests covering causal links from attention items to model calls and egress dispatches.
- [x] 3.3 Add regression tests proving timeout, stop, and abort produce distinct persisted trace/model outcomes.
