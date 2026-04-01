## 1. Backend lifecycle contracts

- [x] 1.1 Extend settings/session-config to include workspace message defaults used by `chat-main` bootstrap.
- [x] 1.2 Finalize message-system archive + token-hint contracts (types/db/control-plane/tests).
- [x] 1.3 Add session-runtime/app-kernel/trpc/client-sdk APIs for channel archive + includeArchived list query.
- [x] 1.4 Add session-runtime/app-kernel/trpc/client-sdk APIs for terminal list/create/focus/delete.
- [x] 1.5 Ensure lifecycle attention commits are emitted for chat and terminal admin actions.

## 2. Chat and terminal surfaces

- [x] 2.1 Replace direct create actions with chat pre-create metadata dialog (admin token + participants + metadata).
- [x] 2.2 Add explicit chat focus/archive actions and protect built-in `chat-main` archive path.
- [x] 2.3 Refactor metadata disclosure form for stable row keys and explicit labels.
- [x] 2.4 Add terminal create/focus/delete controls with advanced create options.

## 3. Quick Start config controls

- [x] 3.1 Add room-config and add-terminal actions in Quick Start header.
- [x] 3.2 Add terminal chips with edit/delete actions.
- [x] 3.3 Persist quickstart chat/terminal defaults to workspace local settings layer.

## 4. Verification

- [x] 4.1 Add/update backend tests for archive/token-hint/terminal lifecycle APIs.
- [x] 4.2 Add/update Storybook DOM tests for chat metadata flow, terminal lifecycle controls, and quickstart config controls.
- [x] 4.3 Run targeted verification commands and record outputs.

## 5. AI-facing metadata closure

- [x] 5.1 Add `message_channel_list` and `message_channel_get` model tools for message-system channel metadata discovery.
- [x] 5.2 Ensure message lifecycle attention commits carry structured channel payloads (title/participants/metadata/focus state).
- [x] 5.3 Make lifecycle commits non-blocking by default (`score=0`) so metadata facts do not become unresolved attention debt.

### Verification log

- `bun test packages/app-server/test/trpc-router.test.ts packages/message-system/test/message-system.test.ts packages/client-sdk/test/runtime-store.test.ts`
- `bun test packages/app-server/test/agenter-ai.test.ts`
- `bun test packages/app-server/test/trpc-router.test.ts packages/app-server/test/session-runtime.attention-system.test.ts`
- `bun run --filter '@agenter/webui' test:unit`
- `bun run --filter '@agenter/webui' test:dom`
