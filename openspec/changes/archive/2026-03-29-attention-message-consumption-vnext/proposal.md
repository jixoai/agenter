## Why

The current runtime still treats message delivery to attention as an append-only side effect:

- user text is appended and immediately projected as transcript history,
- LoopBus only knows `attentionWillLoad`, not a real permission gate for whether an invalidated source may become attention input,
- queued chat input cannot stay editable while unread,
- frontend tab selection still mutates semantic focus,
- compact replay still carries old reply artifacts back into the prompt window.

That breaks the attention-first law. `message-system` should own communication facts, `loopbus` should own the lifecycle gates, and `AgenterAI` should not replay stale relay text as if it were durable memory.

The user also clarified one more platform rule: when the model is about to continue after tool execution, newly queued chat input is allowed to join that next request if the runtime says it is loadable. That means the kernel needs an explicit `can input` style lifecycle gate instead of hard-coded append behavior.

## What Changes

- Add a first-class `attentionShouldLoad` hook to the LoopBus plugin pipeline.
- Upgrade `message-system` with durable attention-consumption lifecycle fields so queued messages stay pending until the assistant actually reads them.
- Add queued-message editing for unread chat input and persist lifecycle state into `session-system`.
- Update `session-runtime` to mark messages as read only when they are truly loaded into attention and to stop coupling selected tabs to semantic focus.
- Remove compact ready-reply replay from `AgenterAI`; compact memory should preserve decisions, files, facts, unresolved work, and next steps, not replayable relay text.
- Upgrade `web-chat-view` and `webui` so pending queue, explicit focus toggles, unread badges, and compact-cycle affordances all reflect the new kernel contract.

## Capabilities

### Modified Capabilities

- `loopbus-plugin-pipeline`
- `message-chat-control-plane`
- `session-runtime-attention-message`
- `web-chat-view`
- `webui-chat-navigation`
- `cycles-devtools-timeline`
- `attention-prompt-window-compaction`

## Impact

- `packages/app-server/src/loopbus-plugin-runtime.ts`
- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/agenter-ai.ts`
- `packages/message-system/src/*`
- `packages/session-system/src/*`
- `packages/web-chat-view/src/*`
- `packages/webui/src/router.tsx`
- `packages/webui/src/features/chat/*`
- `packages/webui/src/features/terminal/*`
- related tests and real-loopbus scenarios
