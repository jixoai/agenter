## Why

Chat is still carrying technical rendering and legacy assumptions from attention/tooling flows. The message control plane currently only models text-like records, which blocks clean support for channel-native error notices and interactive guidance messages. We need Chat to be a pure message-system surface.

## What Changes

- **BREAKING** evolve message records to typed kinds: `text`, `error`, `interactive`.
- Add admin-token-only channel API for sending error messages (`message.sendError`).
- Add channel API for sending interactive messages (`message.sendInteractive`) with v1 form payload.
- Update Web chat transport/state/rendering to consume typed message records.
- Simplify Chat route rendering: remove tool-call/tool-result rendering branches from Chat transcript.
- Keep interactive-message v1 lightweight: submit converts form input into a normal text send.

## Capabilities

### New Capabilities
- `message-chat-control-plane`: typed message records and dedicated error/interactive send APIs.
- `web-chat-view`: channel-native rendering for text/error/interactive rows.

### Modified Capabilities
- `workspace-chat-surface`: Chat transcript becomes message-channel-first and no longer shows technical tool invocation UI.
- `chat-channel-access-control`: error message send is explicitly admin-gated.

## Impact

- Affected code: `packages/message-system`, `packages/app-server`, `packages/client-sdk`, `packages/web-chat-view`, `packages/webui`.
- Verification: message-system unit/integration tests, Web chat stories/DOM tests for typed rows and interactive submit behavior.
