# flutter-chat-view agent notes

## Objective

Implement a Flutter chat-view that stays protocol-compatible with `packages/message-system` and `packages/web-chat-view`.

## Rules

- Do not invent a new websocket protocol.
- Do not invent a new channel id scheme.
- Treat `chat-channel` as the service boundary and `chat-view` as the rendering boundary.
- Keep message history reverse-paged and long-history friendly.
- Keep plugin contracts explicit; do not bury plugin behavior inside the core composer.

## Required compatibility

- direct channels: `chat-*`
- rooms: `room-*`
- websocket endpoint: `ws://HOST:PORT/chat/$CHAT_ID`
- transport events: `snapshot`, `messages`, `page`, `focus`, `error`
- client actions: `send`, `page`, `focus`

## Deliver implementation later

When real Flutter code starts, validate each milestone against:

1. `packages/message-system/src/types.ts`
2. `packages/web-chat-view/src/types.ts`
3. `packages/web-chat-view/src/chat-channel-state.tsx`
