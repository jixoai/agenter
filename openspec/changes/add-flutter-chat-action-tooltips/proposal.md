## Why

The compact conversation shell now uses icon-only navigation and action controls, but pointer users still need quick hover help and touch users need a long-press fallback. The existing accessibility labels solve assistive tech semantics, not visible discoverability.

This change adds tooltip behavior at the shared Apple icon-action primitive so feature code does not repeat local hover/long-press wrappers.

## What Changes

- Add tooltip/long-press help to `AppleIconButton` using the existing localized action label.
- Keep tooltip semantics excluded so each icon-only action still exposes exactly one labeled semantic button.
- Add a widget contract for product-shell icon tooltips.
- Update durable design/spec rules for icon-only action discoverability.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `flutter-chat-view`: Product-shell icon-only action requirements add visible tooltip/long-press discoverability while preserving single-button semantics.

## Impact

- Affected code:
  - `packages/flutter-chat-view/example/lib/app/widget/apple_icon_button.dart`
  - `packages/flutter-chat-view/example/test/widget_test.dart`
- Affected docs/spec:
  - `packages/flutter-chat-view/DESIGN.md`
  - `packages/flutter-chat-view/SPEC.md`
  - `openspec/specs/flutter-chat-view/spec.md`
