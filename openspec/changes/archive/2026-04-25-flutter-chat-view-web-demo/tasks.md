## 1. Flutter chat package foundation

- [x] 1.1 Finalize the `packages/flutter-chat-view` package surface, metadata, and dependencies for a reusable controller/model/widget package.
- [x] 1.2 Implement canonical room transport parsing, message merge, asset upload, and composer plugin contracts with package-level tests.

## 2. Standalone demo shell

- [x] 2.1 Build the standalone `packages/flutter-chat-view/example` demo with configurable `url + token`, query-parameter hydration, and a shareable demo link.
- [x] 2.2 Verify the demo shell layout and smoke coverage for compact and desktop-like viewports without any `packages/webui` integration.

## 3. Durable docs and verification

- [x] 3.1 Update Flutter package docs and durable specs to reflect the room-first contract, phase-1 scope, and demo-only delivery path.
- [x] 3.2 Run Flutter tests and static analysis for the package and example, then remove generated noise that should not be committed.
