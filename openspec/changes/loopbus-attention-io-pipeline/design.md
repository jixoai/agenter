## Context

Terminal and message systems must integrate through the same attention-first contract. The current plugin runtime only knows how to invalidate and read sources.

## Decisions

### Ingress and egress are separate adapter families
LoopBus keeps:
- source adapters for inbound invalidation -> attention drafts
- egress adapters for committed attention item -> external side effect

### Lifecycle
The runtime lifecycle is:
1. invalidate
2. read
3. transform
4. commit
5. dispatch
6. cycleShouldStart
7. cycleWillCallModel
8. cycleDidCallModel / cycleDidAbort

### Dispatch contract
Dispatch receives:
- `contextId`
- committed `AttentionItem`
- `AbortSignal`
- service registry access

Egress adapters decide whether to consume an item. LoopBus remains system-agnostic.

### Abort propagation
All model-call lifecycle hooks receive the same `AbortSignal` used for the active cycle. `stop` aborts the signal. `abort` also tears down the runtime.
