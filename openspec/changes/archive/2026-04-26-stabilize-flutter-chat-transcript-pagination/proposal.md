## Why

The Flutter transcript currently renders message history in chronological order but does not guarantee that entering a room starts at the latest message. Older history is reachable through a visible "load older" row, but mature chat behavior expects the list to open at the bottom and request older pages when the operator scrolls upward.

This change makes bottom anchoring and upward pagination part of the transcript law rather than a host-shell patch.

## What Changes

- On initial non-empty transcript render, jump to the newest message at the bottom.
- Continue auto-following new messages only while the operator remains near the latest edge.
- When the operator scrolls near the top and `hasMoreBefore` is true, request the next older page automatically.
- Preserve the visible anchor when older messages are prepended so the viewport does not jump.
- Keep the existing "load older" row as a visible loading/fallback affordance.
- Add BDD widget tests covering initial bottom anchoring and upward pagination.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `flutter-chat-view`: Transcript affordance requirements now include latest-edge initial anchoring and upward reverse pagination.

## Impact

- Affected code:
  - `packages/flutter-chat-view/lib/src/widgets/flutter_chat_view.dart`
  - `packages/flutter-chat-view/test/chat_transcript_scroll_test.dart`
- Affected specs/docs:
  - `packages/flutter-chat-view/SPEC.md`
  - `openspec/specs/flutter-chat-view/spec.md`
- Validation:
  - Flutter package analyze/test.
  - Example analyze/test to guard shell integration.
