## Why

当前系统真正的 read truth 已经在每条 room message 的 `readActorIds` / `unreadActorIds` 上，但公开投影又额外发明了 `readProgress` 和一组 “latest visible” seat flags。这样把“消息级事实”和“房间级摘要”混成两套语义，导致 runtime 已经把消息标成已读时，UI/Heartbeat 仍可能因为摘要投影滞后而表现成“没读”。

## What Changes

- **BREAKING** Remove public room-level `readProgress` from message-system projections, app-server public room payloads, and runtime tool views.
- **BREAKING** Rename room-level `readStates` to `seatStates` and limit that projection to durable seat facts such as role, admin, focus, online, and credential validity.
- Make room read acknowledgement and replay logic derive only from durable message rows in the current snapshot instead of `latestVisible` room-summary fields.
- Remove room-level read summary UI from room management and related surfaces; keep message-local read affordances on transcript rows.
- Update OpenSpec and tests so “message-level read truth only” becomes the durable contract.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `message-read-state`: Room read truth must stay message-native; room projections must stop publishing synthetic latest-visible progress.
- `client-runtime-store`: Cached room state must stop reconciling room snapshots from room-summary read projections.
- `message-system-surface`: Room surfaces must present seat metadata without reviving room-level read progress.
- `chat-surface-presentation`: Group chat presentation must keep read affordances attached to message rows only.

## Impact

- `packages/message-system/src/*`
- `packages/app-server/src/*`
- `packages/client-sdk/src/*`
- `packages/webui/src/lib/features/messages/*`
- `openspec/specs/message-read-state/spec.md`
- `openspec/specs/client-runtime-store/spec.md`
- `openspec/specs/message-system-surface/spec.md`
- `openspec/specs/chat-surface-presentation/spec.md`
