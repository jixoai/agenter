## Why

`flutter-chat-view-web-demo` 已经证明 Flutter 侧 room transport law 可以跑通，但当前交付仍然是一个 demo operator shell：连接配置、消息舞台、状态与细节都混在同一个页面里，无法支撑产品级的信息架构、交互分层和后续 4 端迁移。现在需要把 Flutter Web 轨道从“可连接的 demo”升级成“独立产品壳”，同时保持不污染 `packages/webui`。

## What Changes

- Replace the current example demo shell with a product-grade standalone Flutter app shell that separates profile management, chat stage, and detail surfaces.
- Add persistent connection profiles and active-profile lifecycle so operators do not re-enter `url + token` on every visit.
- Restructure the chat experience into responsive product spaces:
  - profile rail / compact navigation
  - conversation-first chat stage
  - detail rail for room facts and selected message detail
- Upgrade the Flutter chat stage primitives to support host-owned shell composition, message selection, time dividers, and return-to-latest affordances.
- Keep the room transport / asset upload / composer plugin law in `packages/flutter-chat-view`, but move product navigation and configuration UI into the standalone app shell.

## Capabilities

### New Capabilities
- `flutter-chat-view-product-shell`: standalone Flutter product shell for room chat, including persistent connection profiles, responsive shell layout, conversation-first stage composition, and detail surfaces without any `packages/webui` embed.

### Modified Capabilities
- `flutter-chat-view`: extend the Flutter package from transport-capable demo widgets into reusable chat-stage primitives that can be embedded inside a host-owned product shell.

## Impact

- Affected code:
  - `packages/flutter-chat-view`
  - `packages/flutter-chat-view/example`
  - `openspec/specs/flutter-chat-view/spec.md`
- Affected systems:
  - Flutter Web standalone delivery surface
  - room transport websocket
  - room asset upload API
  - local product-shell profile persistence
- Non-goals:
  - no `packages/webui` integration
  - no native packaging milestone yet
