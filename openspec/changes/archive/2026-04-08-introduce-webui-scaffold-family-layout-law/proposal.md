## Why

The Svelte WebUI now has a shared `ScrollView` primitive and fewer raw overflow violations, but the main layout law still lives in feature code. Route shells, dialogs, and split panes continue to hand-author `grid/flex + h-full + minmax(0,1fr)` combinations, which makes the same stretch-layout mistakes recur across messages, terminals, runtime, onboarding, and other operator surfaces.

This is now a platform-law problem, not a page bug.

- The current layout contract depends on local class composition instead of a durable scaffold primitive.
- `ScrollView` can only solve scroll ownership after a parent gives it the correct stretch region, and that parent contract is still being rewritten by hand.
- Dialogs and split panes repeat the same shell logic with slightly different classes, which keeps producing overlap, duplicate padding rings, and missing scroll owners.
- Some best-practice rules can be enforced statically, but Svelte template layout cannot be guarded by script lint alone, so the repository needs a stronger combined contract.

## What Changes

- Introduce a scaffold-family layout layer for WebUI:
  - `Scaffold` for fixed header/footer plus one body region
  - `DialogScaffold` for dialog-local chrome and one scroll body
  - `SplitView` for common sidebar/content/detail page shells
- Rebuild the highest-risk WebUI surfaces on those primitives instead of hand-written shell classes.
- Keep `ScrollView` as the only scroll primitive, but make scaffold primitives the default way to create stretchable regions.
- Add stronger verification so WebUI layout regressions are blocked both by source-contract tests and by script-level lint where that is technically possible.

## Capabilities

### Modified Capabilities

- `overflow-layout-contract`
- `scrollview-surface`
- `message-system-surface`
- `workspace-runtime-shell`
- `terminal-system-surface`
- `superadmin-onboarding`
- `webui-layout-review-rubric`

## Impact

- `packages/webui/src/lib/components`
- `packages/webui/src/lib/features/messages`
- `packages/webui/src/lib/features/runtime`
- `packages/webui/src/lib/features/terminals`
- `packages/webui/src/lib/features/settings`
- `packages/webui/tests`
- `openspec/specs/*`
