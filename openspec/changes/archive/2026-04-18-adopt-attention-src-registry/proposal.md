## Why

The runtime still exposes source identity through hard-coded `systemId` / `subjectId` / `channelId` fields, and notification resolution still special-cases message and terminal behavior in shared layers. That violates the platform law: source systems should register protocols once and then interact through a shared `src` contract, not through kernel-owned branching logic.

## What Changes

- **BREAKING** Replace shared attention source coordinates with a single protocol address string `src`, and introduce an attention-side namespace registry that owns `format`, `parse`, `key`, and source-adapter lookup by namespace.
- **BREAKING** Remove message-specific notification fields such as `notification.messageId` / `messageSeq` from shared notification contracts, and replace them with protocol-native `src`.
- **BREAKING** Stop exposing `systemId` / `subjectId` / `channelId` as the shared durable source contract in attention commits, runtime publication, and notification projection.
- Split `web-chat-view` identity into `viewKey` for UI merge/optimistic behavior and explicit numeric `messageId` for durable room messages.
- Update client/runtime consumption so notification visibility, source resolution, and transcript identity all follow the new protocol law without a compatibility shim.

## Capabilities

### New Capabilities
- `attention-src-registry`: Define namespace-based source address registration and the shared `src` protocol contract for attention, notification, and runtime source adapters.

### Modified Capabilities
- `attention-source-plugins`: Source adapters invalidate and resolve protocol-native `src` addresses through the registry instead of shared typed coordinate bags.
- `attention-native-context-graph`: Commit provenance stores protocol-native source identity as `src` instead of `systemId` / `subjectId` / `channelId`.
- `attention-notification-push`: Notification projection and consumption use `src` and namespace-driven source resolution instead of message-specific fields.
- `web-chat-view`: Shared chat transport separates UI `viewKey` from durable numeric room `messageId`.
- `client-runtime-store`: Client normalization and notification consumption follow the new `src` contract and no longer depend on shared string `messageId` semantics outside durable room transport.

## Impact

- `packages/app-server/src/loopbus-plugin-runtime.ts`
- `packages/app-server/src/session-notifications.ts`
- `packages/app-server/src/app-kernel.ts`
- `packages/app-server/src/attention-model-view.ts`
- `packages/app-server/src/runtime-tool-views.ts`
- `packages/app-server/src/agenter-ai.ts`
- `packages/client-sdk/src/runtime-store.ts`
- `packages/client-sdk/src/types.ts`
- `packages/web-chat-view/src/*`
- Related backend/client integration tests and affected OpenSpec specs
