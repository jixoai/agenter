## Context

The previous change established the correct platform law: compact chat is conversation-first, and profile/detail/message facts are secondary or tertiary route surfaces. The remaining issue is that these surfaces must now be made stable and native-feeling as reusable primitives.

Observed problems:

- Compact room details can look like an incidental short bottom popup instead of an intentional inspector route.
- Compact profile and detail surfaces rely on the same sheet shell even though they have different semantic depths.
- Icon-only actions currently produce duplicate Web accessibility nodes in browser snapshots: one labeled button and one unlabeled button.
- Future tooltip/menu/popover work will become fragile if the current primitives do not own sizing, safe-area, and semantics.

## Goals / Non-Goals

**Goals:**

- Give compact route sheets explicit detents:
  - profile directory: large route sheet
  - room inspector: inspector detent
  - message inspector: inspector detent
- Keep sheet content constrained, scrollable, and safe-area aware.
- Keep the active conversation root free of persistent bottom app navigation.
- Ensure icon-only actions expose exactly one semantic button with a localized label and 44pt hit target.
- Keep these changes in the example host shell; reusable chat package law remains rendering/transport/composer oriented.

**Non-Goals:**

- Do not introduce a new router package.
- Do not move app shell route state into `lib/`.
- Do not fake iOS 26 Liquid Glass, drag handles, or native detent APIs unavailable in Flutter stable.
- Do not redesign transcript bubbles, transport, upload, or markdown rendering.

## Decisions

### Decision 1: Compact route sheets have semantic detents

Introduce `CompactRouteSheetDetent` as a small host-shell primitive:

- `page`: large sheet for profile directory and other secondary pages that need browsing.
- `inspector`: medium-large sheet for room facts and selected-message facts.

This is intentionally not a generic "height parameter" scattered through feature code. The detent is a route-surface semantic, and the primitive owns the actual height factor.

### Decision 2: Sheet shell owns constraints and safe area

`CompactRouteSheet` owns:

- width = viewport width
- height = semantic detent factor
- bottom alignment
- top navigation title/close affordance
- bottom safe-area for content

Child atoms such as `ProfileRail` and `DetailRail` continue to own their content and scrolling behavior. The sheet only constrains them.

### Decision 3: Icon semantics are a primitive concern

`AppleIconButton` SHALL expose one semantic button with a localized label. It SHALL suppress child icon semantics and any duplicated unlabeled button node while preserving pointer/touch behavior and 44pt minimum hit target.

This keeps feature code from repeating accessibility patches and prevents browser snapshots from accumulating unlabeled ghost buttons.

## Risks / Trade-offs

- [Risk] Flutter Web semantics can differ from native semantics. Mitigation: assert browser snapshot behavior manually and keep widget tests at the stable API level.
- [Risk] Medium sheet detents may need tuning after real content grows. Mitigation: use semantic enum values instead of magic numbers in call sites.
- [Risk] `CupertinoPopupSurface` is not a full native iOS detent sheet. Mitigation: keep the implementation conservative and avoid claiming native drag-detent parity.

## Migration Plan

1. Add `CompactRouteSheetDetent` and make `CompactRouteSheet` use semantic height factors.
2. Pass page/inspector detents from route-sheet presenter functions.
3. Fix `AppleIconButton` semantics in the primitive.
4. Add/extend widget tests for profile and detail sheet detent projection.
5. Update `DESIGN.md`, `SPEC.md`, and `openspec/specs/flutter-chat-view/spec.md`.
6. Run Flutter analyze/test and WASM desktop/mobile walk-through.
