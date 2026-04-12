## Why

The current room message flow mixes three different concerns into one schema: durable message facts, per-actor read facts, and AI scheduling state. That coupling made room replies, restart replay, and unread wake-up behavior fragile because `message-system` was forced to understand AI-only concepts such as `attentionState` instead of remaining a room-first fact store.

The runtime also failed to consistently follow the intended unread subscription + `waitUntil(...)` law. As a result, some cycles polled or repaired state ad hoc instead of deterministically sleeping until message unread state changed, which amplified regressions in room read handling.

## What Changes

- **BREAKING** Remove AI-specific message scheduling state such as `message.attentionState` from `message-system` durable message truth.
- Add durable actor-scoped unread state to `message-system`, split between global actor state and per-room actor state.
- Add unread query + subscription primitives so runtimes can wait on unread state changes instead of inferring wake-ups from message rows alone.
- Change runtime message ingestion so each cycle first queries unread room state, selects focused rooms, pages recent unread messages, and converts them into attention-items.
- Change read timing so runtime marks unread room messages as read only when a real model request is dispatched, not when unread candidates are merely discovered.
- Preserve frozen per-message `readActorIds` / `unreadActorIds`, but treat per-actor unread counters and room subscriptions as the primary cycle ingress mechanism.
- Clear actor-room unread state immediately when a user/avatar loses room access so unread obligations do not survive revoked permissions.

## Capabilities

### New Capabilities
- `message-actor-read-state`: durable actor-level and actor-room unread state, unread counters, and unread subscriptions for message-driven runtimes.

### Modified Capabilities
- `message-chat-control-plane`: message-system stops carrying AI scheduling state and exposes unread-state query/subscription primitives as first-class room control-plane behavior.
- `message-read-state`: frozen per-message read arrays remain durable truth, while actor-level read progress and unread counters become explicit state instead of being inferred from AI-only message fields.
- `session-runtime-attention-message`: runtime ingests unread room work through actor unread state and only marks messages read once a model request is truly dispatched.
- `attention-runtime-scheduling`: loop wake-up rules explicitly include subscribed unread-state waits instead of relying on ad hoc polling or message-row heuristics.

## Impact

- Affected systems: `packages/message-system`, `packages/app-server`, `packages/webui`, `packages/web-chat-view`.
- Affected durability: message-system SQLite schema, runtime unread projections, message transport payloads, and room snapshot/query types.
- Affected APIs: room snapshot/page payloads, unread query/subscription APIs, runtime wake scheduling, and mark-read timing semantics.
- Breaking reset is acceptable for message durability and unread state because this migration intentionally redefines durable room/message law.
