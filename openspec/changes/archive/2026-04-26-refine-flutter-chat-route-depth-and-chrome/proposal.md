## Why

The current compact Flutter app shell treats profiles, conversation, and room details as equal bottom-tab destinations. That route law makes the active chat page compete with app-level navigation, which conflicts with Apple’s iOS 26 official app evidence: Messages keeps the conversation content and composer as the primary route, while navigation, details, and extra actions move into navigation-bar controls, sheets, menus, or secondary pages.

This change is needed before adding more secondary/tertiary chat affordances. If the shell keeps the current `IndexedStack + bottom nav` model, every new feature will become tab glue instead of an adaptive route system.

## What Changes

- **BREAKING**: Replace compact `ProductShellTab` as the route law with a conversation-first route depth model.
- Remove persistent bottom navigation from the compact active chat page.
- Move profile discovery/activation into a secondary compact route surface, such as a pushed page or modal sheet reachable from the leading navigation action.
- Move room facts, participants, and selected-message facts into inspector surfaces that adapt by size class:
  - expanded: persistent trailing inspector
  - standard: secondary inspector sheet or pushed route
  - compact: pushed detail page or bottom sheet, not a bottom tab
- Move secondary chat actions into contextual iOS-native affordances: navigation trailing action, `CupertinoActionSheet`, popover/menu where available, or message-local context surface.
- Add restrained hierarchy animations for route-depth transitions and inspector presentation; animation must communicate navigation depth, not decorative motion.
- Preserve keyboard reachability, localization, and room transport/controller boundaries.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `flutter-chat-view`: App-shell adaptive navigation and host-owned chat chrome requirements change from compact bottom-tab parity to conversation-first route depth.

## Impact

- Affected host shell code:
  - `packages/flutter-chat-view/example/lib/app/controller/product_shell_controller.dart`
  - `packages/flutter-chat-view/example/lib/app/model/product_shell_layout.dart`
  - `packages/flutter-chat-view/example/lib/app/widget/product_shell_page.dart`
  - `packages/flutter-chat-view/example/lib/app/widget/chat_stage_panel.dart`
  - `packages/flutter-chat-view/example/lib/app/widget/profile_rail.dart`
  - `packages/flutter-chat-view/example/lib/app/widget/detail_rail.dart`
- Affected long-term docs:
  - `openspec/specs/flutter-chat-view/spec.md`
  - `packages/flutter-chat-view/SPEC.md`
  - `packages/flutter-chat-view/DESIGN.md`
- Validation impact:
  - Flutter package and example analyze/test remain required.
  - Compact route behavior needs widget tests for “no bottom nav on chat”, profile route access, inspector route access, and selected-message inspection.
  - Web/WASM manual walk-through remains required after implementation because this shell is currently Web-first.
