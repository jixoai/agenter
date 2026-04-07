## Architecture Notes

### 1. Sender identity must be explicit, not inferred

- The room token proves which seat is being used.
- The operator can choose a `View as` actor, but the send path must carry that actor id explicitly.
- The control plane must validate `sendAsActorId` against the grant token before persisting `senderActorId`.
- This restores the platform law that transcript alignment is a projection of durable message truth, not a UI-local guess.

### 2. Shared transcript rows must use shared primitives

- Right-click behavior must come from a real `ContextMenu` primitive.
- Message bubble chrome must exist once, at the row level.
- Markdown rendering for transcript messages returns to a CodeMirror-based preview component so message rendering and composer editing share the same language/runtime family.
- The transcript renderer remains orthogonal: host code supplies actor presentation and read metadata; row rendering owns only local presentation and actions.
- Read-progress affordances are part of the row primitive, so their inline placement must follow bubble ownership. A viewer-owned row cannot reverse the entire row body and accidentally move the indicator to the wrong side of the bubble.

### 3. Read-state belongs to messages, not mutable room membership

- Each message freezes the collaborator set that mattered when it was sent:
  - `readActorIds`
  - `unreadActorIds`
- Marking read moves actor ids from `unreadActorIds` to `readActorIds` for the target visible message and every earlier visible message.
- New room users affect only future messages, because older messages already froze their collaboration set.
- This replaces cursor-derived historical projection with message-local durable truth.

### 3.1 Latest-visible ack must be actor-scoped and idempotent

- The WebUI still needs a local "already acked / currently pending" floor so scroll and observer churn do not issue duplicate mark-read mutations.
- That floor belongs to the viewer actor, not to whichever access token source happened to resolve first.
- The route must merge its transient floor with the durable floor already encoded in message `readActorIds`; if the visible message is already read for the current actor, no mutation should be emitted.
- This keeps repeated hydration, grant refresh, or token-source swaps from re-sending `/trpc/message.globalMarkRead` for the same actor and row.

### 4. Breaking migration is the correct path

- The current `chat_read_state` table encodes a different model.
- Backfilling arrays from cursor state would still preserve the wrong law for historical membership.
- The chosen design is to allow schema reset / destructive migration rather than add a compatibility layer that keeps the old model alive.

## Verification Slice

- message-system and app-server integration coverage for validated `sendAsActorId` and per-message read arrays
- web-chat-view rendering tests for single-surface rows, standard context menu behavior, and CodeMirror transcript rendering
- targeted webui typecheck for Room route assembly
- browser verification that idle Room view no longer repeats `message.globalMarkRead` for an already-read latest visible message
