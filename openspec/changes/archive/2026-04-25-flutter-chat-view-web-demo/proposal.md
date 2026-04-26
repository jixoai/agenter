## Why

`packages/flutter-chat-view` 已经从文档占位开始进入真实实现阶段，但当前仓库里还没有一个可直接访问真实 message-system room transport 的 Flutter Web 输出面，也没有把 Flutter 侧的 transport law、附件上传 law、composer plugin law 固化成可实施的 contract。现在需要先交付一个独立 demo 链接而不是嵌入 `packages/webui`，用最纯的 Web 运行时先验证跨平台可移植内核。

## What Changes

- Add a standalone Flutter Web demo app under `packages/flutter-chat-view/example` that can connect to a room transport using configurable `url + token`.
- Implement a renderer-neutral Flutter chat kernel in `packages/flutter-chat-view` for room transport state, transcript merge, composer plugins, and attachment upload orchestration.
- Align Flutter transport docs and requirements with the canonical room-first message-system contract: `ws(s)://HOST/room/<chatId>?token=...`, `snapshot/messages/page/focus/error`, and `send/edit/recall/page/focus`.
- Keep the first phase isolated from `packages/webui`; the demo link becomes the only integration surface for this milestone.
- Document the durable boundary between Flutter chat view rendering, room transport, and room asset upload so later Android, iOS, and macOS shells can reuse the same law without web-specific glue.

## Capabilities

### New Capabilities
- `flutter-chat-view-demo`: standalone Flutter Web demo surface that accepts configurable room transport URL and access token, exposes a shareable demo link, and connects without any `webui` embedding.

### Modified Capabilities
- `flutter-chat-view`: update the Flutter chat-view contract from docs-only placeholder rules to the real room transport, attachment upload, controller/state, and plugin-extension requirements used by the Web-first implementation.

## Impact

- Affected code:
  - `packages/flutter-chat-view`
  - `packages/flutter-chat-view/example`
  - `openspec/specs/flutter-chat-view/spec.md`
- Affected systems:
  - message-system room transport websocket
  - room asset upload HTTP surface
  - Flutter Web demo delivery path
- Non-goals for this change:
  - no `packages/webui` embedding
  - no native Android/iOS/macOS packaging yet
