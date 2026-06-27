## Why

Manual acceptance found that shell-next now has the right OpenTUI compositor direction, but several interaction contracts still drift from the intended tmux-like app behavior. The remaining gaps are not isolated visuals: button chrome, pane hit testing, selection copy, and resize delivery need to become stable shell-next/opencompose laws before `agenter shell2` can be evaluated as the cli-shell replacement.

## What Changes

- Unify shell-next interactive button chrome so pane-title actions and statusbar actions use bracketed labels, bold hover, and underline active state.
- Replace the bottom `Help  Chat` text with independently hoverable `[Help] [Chat]` actions that use the same affordance rules as pane-title actions.
- Keep Chat layout actions visually stable: active state is underline, not a different glyph; hover is bold over the whole bracketed button.
- Add click-to-resize one-cell behavior to horizontal and vertical resize handles while preserving drag resize.
- Debounce and coalesce terminal-pane resize delivery so rapid layout changes do not flood the PTY/terminal backend.
- Fix close-confirm top-layer hit regions so the visible `[ Run in background ]`, `[ Terminate terminal ]`, and border `[x]` actions match the clickable cells.
- Restore BDD-covered ShellPane and renderer-pane copy behavior, including primary-selection mirroring and shortcut copy routing.
- Include multi-round self review against the original feedback before verification and commit.

## Capabilities

### New Capabilities
- `shell-next-app-runtime`: Shell-next app runtime interaction contracts for pane chrome, statusbar actions, resize delivery, top-layer hit testing, and copy/selection behavior.

### Modified Capabilities

## Impact

- Affects `apps/shell-next` only for runtime/test implementation.
- Adds OpenSpec artifacts under `openspec/changes/refine-shell-next-interactions`.
- Does not modify `apps/cli-shell`, does not introduce tmux/psmux/native-addon work, and does not switch stable `agenter shell`.
