## Why

Message rooms already rely on etiquette such as "reply promptly" and "send one short acknowledgement before longer work", but `message send` has no way to express "if this acknowledgement is still the latest visible room fact in 30 seconds, remind me to reconsider whether the room needs another reply." That leaves an important collaboration obligation hidden in transient model memory and encourages later hacks that auto-send messages instead of creating explicit attention debt.

We need a small, one-shot follow-up reminder surface now. It must stay bound to the specific sent message, must not pollute durable room truth, and must mature into an `AttentionItem` instead of a synthetic room reply.

## What Changes

- Add an optional object-JSON `followUpAfterMs` field to runtime-local `message send`.
- Bind that follow-up reminder to the successfully sent room message as sender-private runtime state instead of durable room-message truth.
- Keep the reminder eligible only while the anchored message remains the latest visible room message in that room.
- Convert an eligible due reminder into one committed attention item that asks the AI to decide whether another room reply is needed.
- Keep the feature one-shot and etiquette-driven: no recurring schedule, no global default timeout, and no automatic visible room message on expiry.
- Document that the initial implementation may use a lightweight runtime timer bridge, while future durable scheduling belongs in `TaskSystem`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `message-chat-control-plane`: model-facing room send semantics must support sender-private, message-bound follow-up reminder intent without leaking AI scheduling state into durable room truth.
- `attention-runtime-kernel`: eligible due message follow-up reminders must become committed attention instead of hidden callbacks or synthetic room output.
- `runtime-skills-cli-surface`: runtime-local `message send` must expose `followUpAfterMs` on the standard object JSON payload and explain its one-shot attention semantics.

## Impact

- Affected code: runtime-local message descriptor/schema/help, session runtime message-send pipeline, reminder scheduling/expiry bridge, and message skill guidance.
- Affected APIs: `message send` object JSON payload shape and local help text.
- Affected tests: runtime CLI validation/help coverage, runtime attention scheduling coverage, and real-AI message-room follow-up scenarios.
- Dependencies: no new external dependency is required; the initial timing bridge remains runtime-local, with a later migration path into `TaskSystem`.
