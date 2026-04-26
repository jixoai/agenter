## 1. Evidence and Route Model

- [x] 1.1 Capture current compact desktop/mobile Web screenshots for active chat, profile list, and detail states.
- [x] 1.2 Add a host-shell route-depth model that replaces compact `ProductShellTab` with conversation, profile directory, room inspector, and message inspector states.
- [x] 1.3 Update keyboard shortcut semantics so shortcuts open route-depth surfaces instead of switching hidden bottom tabs.

## 2. Compact Conversation-First Shell

- [x] 2.1 Remove `_CompactNavigationBar` from the compact active chat path.
- [x] 2.2 Make compact layout render the conversation as the root route with top chrome actions for profile directory and room actions.
- [x] 2.3 Present compact profile directory through a pushed page or Cupertino modal sheet and return to conversation after profile activation.
- [x] 2.4 Present compact room facts and participant details through an inspector route or sheet.
- [x] 2.5 Present compact selected-message facts through a message inspector route or sheet when a transcript row is selected.

## 3. Adaptive Inspector Projection

- [x] 3.1 Keep expanded layout as profile rail + conversation + persistent detail inspector.
- [x] 3.2 Keep standard layout as profile rail + conversation while exposing details through a transient inspector surface.
- [x] 3.3 Refactor `DetailRail` usage so content remains a reusable inspector atom independent of embedded, pushed, or sheet presentation.

## 4. Contextual Actions and Motion

- [x] 4.1 Move profile, reconnect, disconnect, share, and import actions into Cupertino navigation actions or action sheets.
- [x] 4.2 Add restrained route-depth animation for profile directory and inspector presentation without custom fake Liquid Glass effects.
- [x] 4.3 Ensure all icon-only actions keep 44pt hit targets, localization labels, and keyboard/touch reachability.

## 5. Tests and Documentation

- [x] 5.1 Add or update example widget tests for compact chat with no bottom nav, profile route access, room inspector access, and selected-message inspector access.
- [x] 5.2 Update `packages/flutter-chat-view/DESIGN.md` with conversation-first route-depth law and saved iOS 26 reference evidence.
- [x] 5.3 Update `packages/flutter-chat-view/SPEC.md` and sync `openspec/specs/flutter-chat-view/spec.md` after implementation.
- [x] 5.4 Run `flutter analyze` and `flutter test` in `packages/flutter-chat-view`.
- [x] 5.5 Run `flutter analyze` and `flutter test` in `packages/flutter-chat-view/example`.
- [x] 5.6 Build/run the Web target with experimental WASM and manually walk compact route depth before reporting completion.
- [x] 5.7 Capture screenshots for the same compact routes used in task 1.1 and compare against the official reference constraints.
