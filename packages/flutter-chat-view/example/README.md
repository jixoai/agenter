# flutter_chat_view_demo

Standalone Flutter Web product shell for `packages/flutter-chat-view`.

This app is the phase-1 delivery surface for the Flutter chat track. It is intentionally outside `extensions/studio`, persists room connection profiles locally, and connects directly to the canonical room transport using saved profiles or share-link import parameters.

The current shell visual law follows an iOS 26 inspired Liquid Glass hierarchy: floating navigation / function layers use glass, while transcript and room detail content stay on stable material surfaces for readability.

## Run locally

```bash
bun run flutter-chat-view:web
```

The launcher defaults to Flutter Web Wasm mode on port `4291`.
Use `--port` or `PORT` to choose another port:

```bash
bun run flutter-chat-view:web -- --port 4300
PORT=4300 bun run flutter-chat-view:web
```

## Connection model

- profiles persist `name + transportUrl + accessToken`
- share links can import `?url=...&token=...`
- profile editing stays in a secondary sheet so the main canvas remains conversation-first

## Adaptive shell law

- `compact < 720`: bottom navigation between profiles, chat, and details
- `standard 720-1099`: persistent profile rail with stacked chat and details
- `expanded >= 1100`: three-column profiles / chat / details

The shell also enables Flutter Web semantics by default, includes baseline keyboard shortcuts (`Alt+1/2/3`, `Esc`, `Alt+C`), and ships `en` plus `zh-Hans` copy.

You can still open the page with query parameters:

```text
?url=ws://127.0.0.1:4600/room/<chatId>&token=msgtok_...
```

The shell can copy a shareable link for the active profile.

## Scope

- no `extensions/studio` embed
- responsive `profiles / chat / details` shell
- room websocket hydration and paging
- room attachment upload via the canonical HTTP API
- baseline `@`, `/`, `$` composer plugin shells
