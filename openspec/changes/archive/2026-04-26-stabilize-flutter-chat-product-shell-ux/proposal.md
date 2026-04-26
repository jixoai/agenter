## Why

The route-depth refactor removed the compact bottom nav, but the product shell still needs a final UX stabilization pass before it is a durable Apple-style host shell. Current weak points are transient surface sizing, safe-area/scroll ownership, and duplicated icon semantics that can make the Web build feel less native and less accessible.

This change turns those details into platform rules instead of one-off visual patches, so future profile, inspector, tooltip, menu, and message actions can attach to stable host-shell primitives.

## What Changes

- Add a compact route-sheet detent law so profile directory, room inspector, and message inspector surfaces have intentional heights instead of incidental popup sizing.
- Keep compact conversation bottom edge reserved for composer; secondary/tertiary surfaces must float above it as explicit route sheets.
- Ensure compact route sheets have a single scroll owner and bottom safe-area padding.
- Fix icon-only Apple action semantics so each action exposes one labeled button, not a labeled wrapper plus an unlabeled duplicate.
- Add tests for route-sheet detent projection and message inspector route depth.
- Update durable Flutter design/spec docs with route-sheet and icon-semantic laws.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `flutter-chat-view`: Product-shell adaptive navigation and accessibility requirements are tightened for compact route sheets and icon-only actions.

## Impact

- Affected host shell code:
  - `packages/flutter-chat-view/example/lib/app/widget/compact_route_sheet.dart`
  - `packages/flutter-chat-view/example/lib/app/widget/product_shell_route_sheets.dart`
  - `packages/flutter-chat-view/example/lib/app/widget/apple_icon_button.dart`
  - `packages/flutter-chat-view/example/test/widget_test.dart`
  - `packages/flutter-chat-view/example/test/product_shell_controller_test.dart`
- Affected long-term docs:
  - `openspec/specs/flutter-chat-view/spec.md`
  - `packages/flutter-chat-view/SPEC.md`
  - `packages/flutter-chat-view/DESIGN.md`
- Validation impact:
  - Flutter package and example analyze/test remain required.
  - Web/WASM manual walk-through remains required for compact chat, profile directory, inspector sheet, and desktop projection.
