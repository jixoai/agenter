## Why

The runtime still allows unresolved attention debt to devolve into no-progress model loops, repeated provider failures, and token burn because `score != 0` is treated as a reason to wake the model again, but not as a disciplined scheduler contract. This has to be fixed before any broader performance work because unbounded retry noise invalidates memory, CPU, and UX measurements.

## What Changes

- **BREAKING** introduce an attention-runtime error-containment contract that distinguishes unresolved work from runnable work, so `score > 0` does not imply immediate model re-entry.
- Add explicit runtime scheduler states for `idle`, `running`, `waiting`, `backoff`, `blocked`, `paused`, and `aborted`, with durable wake metadata such as `wakeCause`, `retryCount`, `blockedReason`, and `nextWakeAt`.
- Require the runtime to detect repeated no-progress rounds and repeated equivalent failures, then suppress further model calls until an external wake cause, a scheduled backoff expiry, or an explicit operator action occurs.
- Require `session.stop` and `session.abort` to cancel in-flight model/tool work through `AbortSignal`-driven control instead of letting requests drift until timeout.
- Persist model-call cancellation as a first-class lifecycle outcome distinct from provider error so Devtools and future automation can tell “user/runtime canceled this” from “provider/runtime failed this”.
- Publish the new containment state through the runtime UI contract so WebUI and diagnostics can explain why a session is waiting, backing off, or blocked instead of appearing to spin forever.

## Capabilities

### New Capabilities
- `attention-runtime-error-containment`: defines how unresolved attention debt, no-progress rounds, repeated failures, and scheduler wake suppression are handled.

### Modified Capabilities
- `runtime-ui-publication`: runtime clients publish blocked/backoff/waiting control state and wake metadata to UI consumers.
- `session-pause-abort-lifecycle`: stop and abort operations cancel in-flight model work through explicit runtime cancellation semantics.
- `model-call-lifecycle`: canceled model calls persist a terminal cancellation outcome distinct from timeout/error.

## Impact

- Affected code spans `packages/attention-system`, `packages/app-server/src/session-runtime.ts`, runtime scheduling/persistence, provider execution wrappers, `packages/client-sdk`, and WebUI runtime inspectors.
- Session runtime facts, cycle records, and model-call records gain new control-state and cancellation fields.
- Real-AI verification must cover both convergence and containment: solvable attention debt continues to progress, while repeated no-progress/failure paths stop burning tokens and surface an explainable blocked/backoff state.
