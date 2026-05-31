## Why

Heartbeat was already specified as one ledger-backed `message_part` stream, but the implementation still retained one internal debt path:

- `scope=heartbeat_part` for structured request / response / compact rows
- `scope=request_aux` for deduplicated bootstrap facts
- `scope=heartbeat` for older chat-wrapper ingress rows and some persisted projections

That split is no longer acceptable. It leaves the runtime with two internal Heartbeat semantics even though the app contract only has one, and it kept cold restore, chat-cycle projection, and browser hydration partially attached to the wrong storage law.

## What Changes

- Collapse the remaining legacy `scope=heartbeat` path so Heartbeat durable truth becomes `scope=heartbeat_part + scope=request_aux` only.
- Remove legacy `heartbeat` reads from session/runtime/app-kernel/client paths that still reconstruct persisted chat or cycles from wrapper rows.
- Persist focused ingress and other non-`ai_call` Heartbeat facts directly into `heartbeat_part` rows instead of emitting legacy wrapper messages.
- Rebuild persisted chat/cycle projection helpers from `heartbeat_part` rows and `ai_call` linkage instead of depending on the deleted wrapper scope.
- Update regression coverage so future changes cannot silently reintroduce a second Heartbeat scope.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `session-ai-call-ledger`: Heartbeat durable truth no longer permits `scope=heartbeat`; request/response/ingress/compact facts all live in `message_part`.
- `runtime-ui-publication`: Heartbeat hydration and live publication consume only the canonical ledger scopes needed by the Heartbeat tab.

## Impact

- Affected code: `packages/session-system`, `packages/app-server`, `packages/client-sdk`
- Affected APIs: persisted chat/cycle projection helpers, `runtime.heartbeatPartsPage`, runtime Heartbeat live publication
- Affected systems: session ledger persistence, cold restore, runtime inspection, cycle projection
