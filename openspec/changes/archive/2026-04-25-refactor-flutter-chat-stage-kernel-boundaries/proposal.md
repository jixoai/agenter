## Why

`flutter-chat-view` has proven the canonical room transport and standalone app shell, but the implementation boundary is now too coarse: controller code owns websocket, upload, state mutation, and presentation-oriented error strings, while stage widgets mix scroll, composer, transcript, notices, and row rendering. The next capability wave—native shells, real host-provided composer capabilities, upload/retry containment, and anchored transcript runtime—will turn those coarse units into coupling hotspots.

## What Changes

- Split the room transport and room asset upload adapters away from `ChatViewController` while preserving the existing easy constructor path.
- Reframe `ChatViewController` as the stage state kernel/view-model that consumes protocol events and emits immutable `ChatViewState`.
- Extract protocol parsing/encoding behind a codec boundary so malformed payloads and unsupported events are tested as protocol behavior.
- Split large stage widgets into smaller transcript, composer, notice, and row primitives without changing app-shell behavior.
- Keep app shell profile persistence and navigation inside `packages/flutter-chat-view/example`; do not touch `packages/webui`.

## Impact

- Affected package: `packages/flutter-chat-view`
- Affected demo shell: `packages/flutter-chat-view/example`
- Affected durable spec: `openspec/specs/flutter-chat-view/spec.md`
- Compatibility: websocket endpoints, event/action names, upload API, and public package exports remain backward compatible.
