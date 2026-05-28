## Why

Manual acceptance showed that `shell-next` still fails the core interaction contract: button hover/active styles drift by surface, ShellPane selection/copy/paste is not usable, resize delivery does not yet behave as debounce plus conflated delivery, and Chat primary selection still cannot be trusted. The previous change passed mock-heavy BDD but did not match the real terminal behavior, so this follow-up change makes those interactions explicit product laws instead of local patches.

## What Changes

- Introduce a shared shell-next Button primitive because OpenTUI provides low-level renderables but no built-in button component.
- Replace ad-hoc pane-title, statusbar, and dialog button rendering with the shared Button primitive so hover is bold-only and active is underline-only everywhere.
- Re-read `extensions/cli-shell` legacy terminal selection/copy/paste behavior as a source reference, copy the needed logic into `extensions/shell-next`, and keep `extensions/cli-shell` unchanged.
- Fix ShellPane selection so mouse drag reaches the terminal projection with correct pane-local coordinates and selection overlays remain visible.
- Fix ShellPane paste so a single paste event reaches the terminal backend once and only once.
- Fix ShellPane copy so host copy shortcuts use backend-owned selected text and OSC52 clipboard delivery without stealing normal terminal input.
- Fix Chat/renderer primary selection behavior so selection completion mirrors to primary without clearing the user-visible selection.
- Make terminal backend resize delivery both debounced and conflated: rapid changes produce one delayed backend resize carrying only the newest size.
- Add BDD scenarios that reproduce the manual failures before implementation and keep multi-turn self-review artifacts in the change.
- Finish with a clean workspace: shell-next code, OpenSpec artifacts, and any unrelated pre-existing dirty state must be explicitly resolved before final report.

## Capabilities

### New Capabilities

- `shell-next-interaction-stability`: Shell-next interaction stability contracts for shared Button rendering, ShellPane selection/copy/paste, renderer primary selection, conflated terminal resize, and clean-workspace completion.

### Modified Capabilities

## Impact

- Affects `extensions/shell-next` implementation and tests.
- Adds OpenSpec artifacts under `openspec/changes/stabilize-shell-next-button-copy`.
- Uses `extensions/cli-shell` only as read-only reference material; this change must not modify cli-shell source or tests.
- Does not change stable `agenter shell` routing, tmux/psmux/native-addon decisions, or OpenTUI upstream code.

## Rework Trigger: Manual Acceptance 2026-05-28

Manual acceptance after `2cb2ea38` showed this change was over-claimed. The implementation now needs another BDD-driven pass for the following concrete failures:

- ChatPane and ShellPane no longer clear selection on middle-click, but primary clipboard still does not work in the real terminal.
- ShellPane copy/paste works, but legacy terminal word movement and keyboard selection were not migrated.
- ChatPane titlebar actions still do not behave like the shared Button primitive.
- Button active state still is not visibly underlined.
- Shell resize still feels blocked under rapid drag; the debounce plus conflated strategy must live at the terminal-source/backend boundary, not only at the pane view boundary.
- Resize handle click micro-adjustment always moves in one direction; the clicked glyph must decide the direction.

This rework keeps the same architectural direction: no `cli-shell` edits, no imports from `cli-shell`, and no OpenTUI upstream patch unless tests prove shell-next cannot work around the behavior locally.
