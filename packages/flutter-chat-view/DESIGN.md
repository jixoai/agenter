# flutter-chat-view design

## Goal

Provide a Flutter-native chat view that matches the canonical Agenter chat-channel protocol used by the message system and the web chat view.

## Core model

### Channel

- A chat view instance binds to exactly one `chat-channel`.
- Direct channels use `chat-*`.
- Multi-party channels use `room-*`.
- Channel metadata comes from the message-system control plane, not from the view layer.

### Transport

- The view connects to `ws://HOST:PORT/chat/$CHAT_ID`.
- The server pushes:
  - initial `snapshot`
  - incremental `messages`
  - reverse-time `page`
  - `focus`
  - `error`
- The client sends:
  - `send`
  - `page`
  - `focus`

### Message history

- Initial render hydrates from `snapshot.items`.
- Older history loads with reverse-time pagination via `nextBefore`.
- The view must preserve newer messages while prepending older pages.
- The viewport must be designed for long-lived conversations and eventual virtualization.

## Extension boundary

The package follows the same separation already established between `chat-channel` and `chat-view`.

### chat-channel owns

- storage
- websocket transport
- message/query/send/focus APIs
- channel metadata
- plugin service endpoints

### chat-view owns

- rendering
- input/composer UX
- message grouping
- scrolling and paging UX
- plugin affordances and injection points

## Plugin model

The Flutter chat view should expose a plugin surface equivalent to the web track.

Initial plugin categories:

- mentions / path picker via `@`
- command palette via `/`
- skills picker via `$`
- attachments
- screenshot capture
- rich previews

Each plugin should be able to:

- extend the composer UI
- invoke channel-side services
- inject message rendering affordances

## Embedding strategy

The package should target:

1. Flutter mobile / desktop
2. Flutter Web embedded inside Agenter WebUI

The Flutter implementation must keep the same channel protocol as `web-chat-view`, so the backend and message-system remain unchanged.
