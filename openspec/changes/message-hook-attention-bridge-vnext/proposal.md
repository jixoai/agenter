## Why

`message-system` should not be a second state machine. Its job is simpler: accept direct AI tool calls and, when possible, extract human-readable output from attention commits and send it to the bound chat channel. The current generic egress model makes message and terminal look symmetrical even though only message needs this automatic extraction behavior.

## What Changes

- **BREAKING** remove generic attention egress dispatch and replace it with commit hooks.
- Add a message commit hook that extracts channel messages from attention commits using objective context/channel facts.
- Add a direct `message_send` AI tool for cases where automatic extraction is insufficient or fails.
- Remove terminal auto-consumption of attention commits; terminal remains source-hook plus direct tools.
- Return hook execution results from `attention_commit` so the AI can react without guessing.

## Capabilities

### New Capabilities
- `attention-commit-hooks`: structured hook results attached to each attention commit.
- `message-hook-bridge`: automatic chat-channel dispatch from eligible attention commits.
- `message-send-tool`: direct message-system tool for explicit sends.

### Modified Capabilities
- `terminal-runtime-io`: terminal commits no longer imply automatic terminal output.
- `chat-surface-presentation`: Chat only shows real channel messages, not raw attention side effects.

## Impact

- Affected code: `packages/app-server`, `packages/message-system`, `packages/i18n-*`, `packages/webui` chat/runtime consumers.
- Verification: integration tests for hook delivery/failure/ignored outcomes and regression coverage for the broken chat-reply session flow.
