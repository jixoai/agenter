# flutter-chat-view agent notes

## Objective

Implement and evolve a Flutter room chat package that stays protocol-compatible with `message-system` while remaining independent from `packages/webui`.

## Rules

- Do not invent a new websocket protocol or room id scheme.
- Treat the controller/model layer as the reusable platform law; widgets and demos are host shells.
- Keep rendering, transport, and attachment upload concerns orthogonal.
- Keep message history reverse-paged and revision-safe for long-lived rooms.
- Keep plugin contracts explicit; do not bury trigger behavior inside the core composer.
- Keep phase 1 delivery scoped to the standalone product shell under `example/`.
- Keep page-level chrome and profile persistence outside the core package.

## Required compatibility

- websocket endpoint: `ws(s)://HOST[:PORT]/room/<chatId>?token=<accessToken>`
- transport events: `snapshot`, `messages`, `page`, `focus`, `error`
- client actions: `send`, `edit`, `recall`, `page`, `focus`
- asset upload: `POST /api/rooms/{chatId}/assets`
- upload header: `x-agenter-room-access-token`

## Implementation checklist

When changing this package, validate against:

1. `packages/message-system` room transport contract
2. `openspec/specs/flutter-chat-view/spec.md`
3. `packages/flutter-chat-view/SPEC.md`
4. `packages/flutter-chat-view/example` as the only phase-1 product shell
