## 1. Route Sheet Primitive

- [x] 1.1 Add semantic compact route-sheet detents for page and inspector surfaces.
- [x] 1.2 Make `CompactRouteSheet` own viewport constraints, bottom alignment, safe-area padding, and title/close chrome.
- [x] 1.3 Pass page detent for profile directory and inspector detent for room/message inspectors.

## 2. Accessibility Primitive

- [x] 2.1 Fix `AppleIconButton` so each icon-only action exposes one labeled semantic button and no unlabeled duplicate.
- [x] 2.2 Preserve 44pt minimum hit target and pointer/touch behavior.

## 3. Tests and Documentation

- [x] 3.1 Add widget tests for compact profile and detail sheet detent projection.
- [x] 3.2 Update `packages/flutter-chat-view/DESIGN.md` with route-sheet detent and icon-semantic laws.
- [x] 3.3 Update `packages/flutter-chat-view/SPEC.md` and sync `openspec/specs/flutter-chat-view/spec.md`.
- [x] 3.4 Run `flutter analyze` and `flutter test` in `packages/flutter-chat-view`.
- [x] 3.5 Run `flutter analyze` and `flutter test` in `packages/flutter-chat-view/example`.
- [x] 3.6 Run experimental WASM Web target and capture desktop + iPhone 14 route evidence.
