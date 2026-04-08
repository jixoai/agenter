## Context

`message-system` currently persists room message facts together with AI-only scheduling fields such as `attentionState`. `session-runtime` then mixes row scans, unread arrays, and ad hoc wake notifications to decide whether a cycle should start. That violates the intended law for this subsystem boundary:

- `message-system` should persist room truth and read truth
- `attention-system` should persist unresolved work truth
- `session-runtime` should translate subscribed system facts into attention-items and sleep on `waitUntil(...)` until a real wake cause appears

In practice, unread room handling drifted away from that law. Some runtime paths used message-row heuristics instead of actor unread subscriptions, and some reads were materialized before a real model request existed. That caused restart replay bugs, self-read misclassification, and room reply wake-up gaps.

The user has explicitly chosen a breaking reset if needed. That removes backward-compatibility pressure and lets this design restore the intended subsystem boundaries instead of layering more glue on top of the current schema.

## Goals / Non-Goals

**Goals:**
- Remove AI scheduling state from durable room messages.
- Make actor unread state explicit and queryable through `message-system`.
- Make cycle wake-up use unread subscriptions plus `waitUntil(...)` instead of ad hoc polling.
- Preserve frozen per-message `readActorIds` / `unreadActorIds` as durable historical truth.
- Mark unread room messages as read only when a real model request is dispatched.
- Bound runtime unread ingestion by configurable room and per-room message limits.
- Clear unread obligations immediately when room access is revoked.

**Non-Goals:**
- Redesign attention scoring, settlement, or compaction semantics.
- Replace human/UI `globalMarkRead` behavior in this change.
- Redesign auth-system principals, grants, or keystore ownership.
- Preserve legacy `attentionState`-backed message durability through compatibility shims.

## Decisions

### 1. `message-system` becomes a fact store again

**Decision:** Remove `message.attentionState` and related AI queue/load semantics from durable room messages.

Durable room messages will keep:
- canonical sender identity
- visible content and attachments
- frozen `readActorIds`
- frozen `unreadActorIds`

Durable room messages will stop carrying:
- AI queue/load state
- AI-only editability gates
- runtime-only delivery progress

**Rationale:** These fields describe runtime scheduling, not room truth. Keeping them in message rows forced `message-system` to know whether AI had “loaded” a room message, which made message facts and attention facts impossible to reason about independently.

**Alternative considered:** Keep `attentionState` and tighten runtime usage. Rejected because it preserves the same mixed ontology and keeps read bugs coupled to AI scheduling bugs.

### 2. Unread state gets first-class actor tables

**Decision:** Add durable unread state split across:
- `actor_state`
- `actor_room_state`

`actor_state` stores actor-global unread facts such as `unreadTotal`, `lastActiveAt`, `lastLoginAt`, online state, and extension KV.

`actor_room_state` stores room-scoped unread facts such as `unreadCount`, `lastReadRowId`, `lastReadAt`, `latestUnreadRowId`, `latestUnreadAt`, and extension KV.

**Rationale:** unread counts and unread room selection are query primitives, not data that should be recomputed from a room’s full message history every time. They also should not be hidden in one opaque KV blob because they need ordering, filtering, and subscriptions.

**Alternative considered:** Single actor KV blob with nested unread maps. Rejected because ordering, subscription fan-out, and room-level indexing become harder and more fragile.

### 3. Frozen message arrays remain the only message-level read detail truth

**Decision:** Keep `readActorIds` / `unreadActorIds` on each message as frozen send-time obligation truth, while actor unread tables only track aggregate progress.

The resulting asymmetry is intentional:
- later-joined actors do not retroactively appear in `unreadActorIds`
- later-joined actors may still be appended to `readActorIds` if they explicitly read old history later
- revoking room access clears unread aggregates, but does not rewrite frozen historical message membership

**Rationale:** Only message-level arrays can answer “who had the obligation at send time?” and “who has actually read this specific historical message?” without letting later room membership mutations corrupt history.

**Alternative considered:** Replace message-level arrays with room cursor math only. Rejected because it loses historical per-message read detail and breaks the “joined later” law.

### 4. Runtime unread ingress starts from subscribed actor unread state

**Decision:** At the start of a cycle, `session-runtime` queries actor unread summaries instead of scanning room messages for queued AI work.

Selection law:
- choose up to `message.maxFocusedRoomCount` rooms, default `3`
- for each selected room, page up to `message.maxBatchReadRoomMessageCount` recent unread messages, default `20`
- convert those room summaries + message slices into attention-items

If the model later needs deeper history, it uses room pagination tools with cursors.

**Rationale:** This keeps cycle ingress bounded, room-aware, and restart-stable. It also makes restarted avatars and warm avatars follow the exact same unread workflow.

**Alternative considered:** Continue scanning all visible messages and infer unread from message rows. Rejected because it is unbounded and encourages more heuristics around “queued” vs “loaded”.

### 5. Read timing moves to model request dispatch

**Decision:** Runtime marks selected unread room messages as read when a real outbound model request is dispatched, not when unread candidates are discovered and not when the first streamed token arrives.

Dispatch means the provider request is actually started, with no immediate request-construction failure.

**Rationale:** Discovering unread messages is too early; first-token gating is semantically nice but introduces unnecessary coupling between read progression and provider streaming latency. Dispatch is the right boundary: the actor has formally consumed the unread slice into one model attempt.

Failed rounds remain safe because attention debt is a separate truth:
- read does not mean resolved
- unresolved attention scores keep later cycles alive
- later cycles can query more room history if needed

**Alternative considered:** Mark read on first streamed token. Rejected because it delays read progression for slow providers and couples read truth to transport timing.

### 6. Scheduler waits on subscriptions instead of polling

**Decision:** `session-runtime` composes `waitUntil(...)` across:
- unread actor subscriptions from `message-system`
- terminal `waitCommitted(...)`
- task/event waiters
- explicit backoff or attention-debt timers

When one wake cause resolves, losers are cancelled and the next loop round records the actual wake cause.

**Rationale:** This is the law the user originally asked for. If a system can tell runtime “nothing changed yet”, runtime should sleep. Polling room history to discover zero unread is wasted work and created the current bug surface.

**Alternative considered:** Keep `notifyInput()` fan-out as the primary wake path. Rejected because it lacks durable causality and drifts into opportunistic wake-ups instead of explicit subscribed waits.

## Risks / Trade-offs

- **[Risk] Breaking durability reset removes compatibility with legacy message rows** → **Mitigation:** treat this change as a schema reset; archive the old law instead of carrying shims.
- **[Risk] Read-at-dispatch can mark messages read before a provider ultimately fails** → **Mitigation:** unresolved attention remains active and queryable, so failed work is still retried without falsifying the message’s historical read fact.
- **[Risk] Subscription fan-out introduces waiter leaks if not cancelled** → **Mitigation:** standardize unread subscriptions as cancellable wait handles and require loser cancellation after each `waitUntil(...)` race.
- **[Risk] Unread aggregates drift from message arrays** → **Mitigation:** derive unread aggregate mutations only from durable send, mark-read, grant, and revoke transactions; do not let runtime write counters directly.

## Migration Plan

1. Add OpenSpec deltas for the new fact boundary.
2. Introduce new message-system schema for `actor_state` and `actor_room_state`.
3. Remove `attentionState` from durable message types, DB schema, and transport payloads.
4. Rebuild message send / mark-read paths so aggregate unread state mutates transactionally with message read arrays.
5. Add unread summary query + subscription APIs to `message-system`.
6. Refactor `session-runtime` cycle ingress to:
   - query unread rooms
   - page unread messages by room
   - compose `waitUntil(...)` with unread subscriptions
   - mark selected unread messages read on model dispatch
7. Update WebUI and room projections to stop depending on durable `attentionState`.
8. Reset message durability / unread state once the new schema lands.

Rollback is a code rollback plus another breaking message-system reset. There is no in-place compatibility rollback target for this change.

## Open Questions

- Should this same change expose actor unread summaries to WebUI directly, or should WebUI continue consuming them indirectly through app-server projections first?
