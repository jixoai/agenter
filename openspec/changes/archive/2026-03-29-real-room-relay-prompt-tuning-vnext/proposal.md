## Why

The new deterministic two-room regression proves the runtime path in a mock environment, but it does not validate whether the real model can actually follow the system prompt and tool contract. Real-provider evidence now shows a concrete gap: the model can discover `gaubee` and dispatch the relay, yet it may still stop before sending the final answer back to `kzf` in the original room or before preserving that fact through compact-driven follow-up.

## What Changes

- Add a real-provider non-GUI regression that boots a real session, manually configures the `kzf` and `gaubee` rooms, and verifies `kzf -> gaubee -> kzf` relay with actual model/tool calls.
- Tighten the multilingual system prompt and tool descriptions so chat-backed work is treated as unfinished until the visible reply is dispatched and the related attention is explicitly settled; for cross-room relay, that includes sending the secondary-room answer back to the originating room.
- Extend the real-provider regression to cover manual `/compact` followed by `中午吃什么`, ensuring the answer can still be recovered from compacted factual history.
- Apply the smallest runtime or LoopBus fix only if the real-provider regression proves that prompt/tool tuning alone is insufficient.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-runtime-attention-message`: Cross-room relay must remain unresolved until the assistant sends the final answer back to the originating room, and the compacted session must preserve that factual answer for follow-up questions.
- `attention-egress-routing`: Chat-backed relay work is not complete until successful message egress reaches both the relay room and the original requester room when the task requires a round trip.

## Impact

- `packages/app-server/test-support/real-*` real-provider kernel harness and scenario helpers
- `packages/app-server/test/real-loopbus.integration.test.ts` real LoopBus regression coverage
- `packages/i18n-*/prompts/*` and `packages/i18n-*/runtime.json` system prompt and tool contract tuning
- `packages/app-server/src/*` minimal runtime or LoopBus adjustments if real evidence shows a platform-rule gap
