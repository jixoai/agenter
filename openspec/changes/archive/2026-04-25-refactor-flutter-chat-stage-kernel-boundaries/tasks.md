## 1. Platform law artifacts

- [x] 1.1 Add OpenSpec proposal, design, tasks, and delta spec for the kernel-boundary refactor.

## 2. Transport and upload boundaries

- [x] 2.1 Extract protocol codec and IO adapter interfaces/default implementations without changing wire compatibility.
- [x] 2.2 Refactor `ChatViewController` to depend on protocol/transport/upload boundaries instead of direct websocket and HTTP details.

## 3. Stage widget atoms

- [x] 3.1 Split transcript viewport, stage notices, and row rendering into smaller package-owned primitives.
- [x] 3.2 Keep product shell plugin/profile/navigation behavior host-owned and compatible.

## 4. Verification

- [x] 4.1 Add BDD tests for protocol errors and adapter-backed controller behavior.
- [x] 4.2 Run Flutter analyze and tests for `packages/flutter-chat-view`.

## 5. Apple platform redesign

- [x] 5.1 Add Apple platform design law and replace iOS-version-branded primitives with stable `Apple*` primitives.
- [x] 5.2 Redesign product shell surfaces as sidebar/content/inspector/tab primitives instead of floating web cards.
- [x] 5.3 Replace conversation empty-state hero card with `AppleContentUnavailable`.
- [x] 5.4 Run package and example Flutter analyzer/tests, then verify wasm web in desktop and iPhone 14 viewports.
- [x] 5.5 Codify Apple spacing/radius rhythm as platform tokens and remove compact route-level card wrapping.
- [x] 5.6 Codify section rhythm primitives and add AI-facing Apple review prompts to `DESIGN.md`.
- [x] 5.7 Codify chat content rhythm tokens and update `DESIGN.md` AI prompt addendum.
