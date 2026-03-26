# flutter-chat-view

`flutter-chat-view` is the Flutter/Flutter Web chat-view track for Agenter.

This package is documentation-first for now. It freezes the transport contract and the extension boundary so a future Flutter implementation can start without reverse-engineering `@agenter/web-chat-view`.

## Scope

- Render one `chat-channel` at a time.
- Connect over `ws://HOST:PORT/chat/$CHAT_ID`.
- Follow the same channel ids as the canonical message system:
  - direct chat: `chat-*`
  - multi-party room: `room-*`
- Keep transport, message model, paging, and plugin contracts aligned with `message-system`.

## Not in scope yet

- Production Flutter widgets
- Flutter Web build output
- Native packaging
- Full plugin runtime implementation

## Related packages

- `packages/message-system`
- `packages/web-chat-view`
- `packages/webui`

## Current deliverables

- `README.md`: package intent
- `DESIGN.md`: transport and plugin architecture
- `AGENTS.md`: implementation rules for future contributors
