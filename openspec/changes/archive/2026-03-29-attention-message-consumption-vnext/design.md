## Context

The architecture intent is now stable:

- `attention` is the kernel truth.
- `message-system` is a communication substrate, not the attention engine itself.
- `loopbus` decides when external facts are allowed to become attention input.
- frontend selection is a view concern; semantic focus is an explicit runtime fact.
- compact is a special cycle that produces a new concise context, not a replay cache for old tool dispatches.

The current code violates those laws in four places:

1. `LoopBusPluginRuntime` only has `attentionWillLoad`, which mutates requests but cannot say "do not load this invalidated source yet".
2. `message-system` persists append-only chat rows without a durable unread/read lifecycle for attention.
3. `session-runtime` eagerly projects inbound chat as transcript history and couples route/tab selection to focus mutations.
4. `AgenterAI` compact summary still serializes `readyReplies`, which replays old relay artifacts back into later prompt windows.

## Goals / Non-Goals

**Goals**

- Add an explicit attention-ingress permission hook that fits the repo's existing `Should*` naming law.
- Keep queued chat input editable until attention actually reads it.
- Make "read" mean "converted into attention input", not merely "rendered by the UI".
- Keep pending queue and transcript ordering durable across refreshes.
- Ensure compact preserves durable facts and unresolved work without replaying stale relay text.
- Decouple view selection from runtime focus, while still allowing explicit focus/unfocus actions.

**Non-Goals**

- No backward-compatibility bridge for the old message lifecycle.
- No attempt to model every possible human recipient receipt in this change.
- No new chat/task/output contract resurrection inside `AgenterAI` or `LoopBus`.

## Decisions

### Add `attentionShouldLoad` as the ingress gate

`LoopBusPluginRuntime` will gain `attentionShouldLoad`, a `first`-style hook that can deny or defer loading an invalidated source. If loading is denied, the source ref remains invalidated for the next eligible round.

Why:

- This matches the existing `cycleShouldStart` naming law.
- `attentionWillLoad` remains a request-mutation hook; it should not double as a permission gate.
- Deferred refs must stay pending instead of being silently dropped.

### Model chat lifecycle as attention-readability, not generic transport flags

`message-system` will store durable fields on each message:

- `updatedAt`
- `visibleAt`
- `attentionState`
- `attentionLoadedAt`

Queued user text remains out of the main transcript until `attentionState` transitions from `queued` to `loaded`. Assistant/system-visible output is created in `loaded` state immediately.

Why:

- The kernel cares about when attention read the message, not just whether a socket delivered it.
- The frontend can derive pending strip vs transcript directly from durable facts.

### Make queued editing a first-class control-plane operation

Unread queued messages may be edited in place. Editing is only allowed while the message is still `queued`. Later queued messages do not need a second suspend state because unread ordering already keeps them pending behind the earlier unread message.

Why:

- This gives the user the requested "edit before AI reads it" capability without inventing fake retract/replay rows.
- It keeps the model-facing queue stable and deterministic.

### Persist message lifecycle into `session-system` by message id

`session_block` will gain message identity and lifecycle columns. Chat-backed blocks will be upserted by `message_id` instead of append-only duplication.

Why:

- Refresh/bootstrap paths currently depend on persisted session history.
- Without durable lifecycle fields, pending/read transitions drift after page reload.

### Remove compact ready-reply replay from prompt-window reconstruction

Compact output will preserve:

- overview
- decisions
- key files
- key facts
- unresolved work
- next steps

It will stop serializing `readyReplies` back into prompt-window messages and stop using compact fast-path replay.

Why:

- Compact is a context reset, not a replay ledger for old tool dispatches.
- The durable fact should be "what was decided / learned", not "what exact reply text should be resent later".

### Separate selected view from semantic focus

Changing the visible chat tab or terminal tab will no longer mutate runtime focus. Focus becomes an explicit user action exposed through dedicated focus/unfocus controls.

Why:

- The UI can only display one pane at a time; that is not the same thing as semantic focus.
- Multiple chats and terminals may be focused simultaneously.

## Risks / Trade-offs

- The message lifecycle touches database schema, runtime projection, websocket transport, and UI together. Partial rollout would leave the system inconsistent, so the change must land end-to-end.
- Removing compact ready-reply replay may reduce one narrow fast path. The trade-off is acceptable because compacted key facts remain available and the replay bug is architecture-corrupting.
- A true "inject new chat input between tool-result iterations" model may require a future model-loop refactor beyond the current `@tanstack/ai` wrapper. This change introduces the kernel hook and durable queue semantics first so that later step-level injection has a clean platform seam.
