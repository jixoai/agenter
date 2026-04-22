# flutter-chat-view

`flutter-chat-view` is the Flutter-side room chat package for Agenter.

Phase 1 is Web-first, but the package is intentionally renderer-neutral: the controller, models, merge logic, and composer plugin contract are shared laws that later Android, iOS, and macOS shells can reuse without inheriting any `packages/webui` coupling.

## Current scope

- Connect to one canonical room transport at a time.
- Derive room identity and HTTP upload base from a configured websocket URL.
- Decode room transport events: `snapshot`, `messages`, `page`, `focus`, `error`.
- Send room actions: `send`, `edit`, `recall`, `page`, `focus`.
- Upload room attachments through the canonical room asset API before send.
- Render a host-composable Flutter chat stage with transcript/composer primitives and explicit plugin hooks.
- Provide package-level localizations for durable stage copy such as retry, composer actions, recalled state, and empty transcript states.
- Ship a standalone Flutter Web product shell under `example/` with persistent connection profiles and share-link hydration.

## Canonical transport contract

- Websocket endpoint: `ws(s)://HOST[:PORT]/room/<chatId>?token=<accessToken>`
- Asset upload endpoint: `POST /api/rooms/{chatId}/assets`
- Upload auth header: `x-agenter-room-access-token`

The package does not invent a second transport protocol. It follows the same room-first law as `message-system`.

## Phase 1 non-goals

- No `packages/webui` embed
- No native Android / iOS / macOS packaging yet
- No final anchored virtualization runtime yet
- No full plugin runtime beyond explicit trigger-plugin hooks

## Public package surface

- `ChatViewController`
- `ChatViewState`
- chat models and transport parsing helpers
- composer plugin contracts
- host-owned `FlutterChatView` stage widgets

## Example product shell

Run the standalone demo:

```bash
cd packages/flutter-chat-view/example
flutter run -d chrome
```

The shell persists connection profiles locally, supports `?url=...&token=...` import links, and keeps room configuration in a secondary workflow instead of the primary conversation canvas.
It now follows a three-state Web shell law:

- `compact < 720`: bottom navigation between profiles, conversation, and details
- `standard 720-1099`: persistent profile rail with stacked conversation + details
- `expanded >= 1100`: three-column profiles / conversation / details

The example app also ships `en` + `zh-Hans`, enables Flutter Web semantics at startup, and provides baseline keyboard shortcuts for shell navigation.

## Verification

```bash
cd packages/flutter-chat-view
flutter analyze
flutter test

cd example
flutter analyze
flutter test
```

## Related packages

- `packages/message-system`
- `packages/web-chat-view`
- `packages/app-server`
