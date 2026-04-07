## Context

The current system already stores durable `readActorIds` and `unreadActorIds` on each room message, so the server-side law is mostly correct. The remaining defect is in the client projection and interaction layer:

- `message-room-route.svelte` resets its per-seat read acknowledgement cache when the shared chat view briefly reports `null` for the latest visible message during observer churn.
- `web-chat-view` only renders a compact ring/check indicator, so the durable actor arrays are not actually inspectable from the message row.
- Shared row actions were removed during crash containment, which left the transcript without its intended local interaction surface.

## Goals / Non-Goals

**Goals:**

- Make `globalMarkRead` idempotent from the frontend by treating read acknowledgement as monotonic progress for each room seat.
- Let each message expose its own read/unread actor detail disclosure without reintroducing room-level aggregate chips.
- Restore shared row actions through the shared row primitive, not through route-local hacks.

**Non-Goals:**

- Redesign room toolbar or room-management information architecture.
- Change backend read-state schema or add a new read table.
- Reintroduce room-header aggregate read progress.

## Decisions

### Client mark-read acknowledgement stays monotonic per room seat

`message-room-route.svelte` will stop clearing the last acknowledged message when `latestVisibleMessageId` briefly becomes `null`. Instead, the route will track the latest acknowledged row order for each `room + accessToken` pair and ignore duplicate or older visible messages. This matches the actual law: once a seat has acknowledged message `mN`, transient viewport churn must not turn that fact back into “unknown”.

### Read disclosure stays message-local and is anchored to the existing inline-end indicator

The compact ring/check remains the default visual affordance. Clicking it opens a lightweight disclosure surface that shows two actor columns, `read` and `unread`, for that specific message. This keeps the transcript dense while still making the frozen actor arrays inspectable.

### Canonical actor projection remains host-owned

`web-chat-view` will not guess names or avatars from raw ids. `message-system-surface` will project the disclosure entries from the same canonical actor truth it already uses for transcript rows and seat lists, then pass those entries through the shared read-progress model.

### Row actions return through one shared action model

`message-row.svelte` will restore its built-in actions plus host-provided actions through one resolved action list. The hover affordance and the context menu will read from the same list so the row stays orthogonal. To avoid the earlier floating-layer regression, menu triggers stay on raw trigger elements rather than layering a custom `Button` wrapper inside the floating primitive.

## Risks / Trade-offs

- [Risk] A visible message may not exist in the current snapshot slice when the callback fires. -> Mitigation: only acknowledge when the target message can be resolved to a durable row in the current snapshot.
- [Risk] Restoring row actions could revive the previous floating-layer crash. -> Mitigation: keep the raw trigger path, add focused tests, and verify in the real route after implementation.
- [Risk] The read disclosure may become visually noisy on compact viewports. -> Mitigation: keep the trigger tiny, portal the disclosure, and constrain the detail panel width.
