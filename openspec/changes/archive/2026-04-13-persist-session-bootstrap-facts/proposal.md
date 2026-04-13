## Why

Fresh runtime sessions currently initialize `session_head.current_prompt_window_id` even when the prompt window is empty, but they do not persist any corresponding `message_part` row. That leaves durable inspection with a dangling prompt-window pointer and makes a newly started session look like an empty ledger even though bootstrap state already exists.

## What Changes

- Persist an explicit durable prompt-window bootstrap fact when a session initializes an empty prompt window.
- Ensure prompt-window restoration treats that bootstrap fact as an empty prompt window, not as a user-visible prompt message.
- Exclude bootstrap-only prompt-window rows from per-request prompt message linkage so AI-call request envelopes still point only at real prompt messages.
- Add regression coverage for fresh started sessions so `session.db` no longer relies on a head pointer without ledger rows.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `session-ai-call-ledger`: Empty prompt-window bootstrap state becomes a durable ledger fact instead of existing only as a `session_head` pointer.

## Impact

- Affected code: `packages/session-system`, `packages/app-server`, session ledger tests.
- Affected durable behavior: fresh session `session.db` contents and prompt-window reconstruction.
- No public API break is intended.
