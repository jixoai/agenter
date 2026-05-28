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

## Second Rework Trigger: Architecture Boundary 2026-05-28

Manual acceptance after `f4b7a687` showed only resize glyph direction and Option+arrow cursor movement were actually solved. The remaining failures are now understood as an architecture boundary problem:

- Terminal input, selection, scroll, copy, paste, and follow-cursor behavior were placed partly in `ShellNextApp` instead of a shell-next terminal engine.
- OpenCompose must stay generic: it owns pane/layout/chrome/event composition and only knows about custom-rendered panes and OpenTUI renderer panes.
- The terminal behavior must not be promoted into an OpenCompose terminal kernel yet. It belongs inside shell-next and the project-owned terminal rendering engine that consumes OpenCompose custom panes.
- Primary clipboard must stay KISS: one explicit primary-copy path, no app-owned primary register, and no dual fallback behavior.

This second rework adds a shell-next-internal Terminal Engine boundary and moves the legacy `terminal2` interaction laws there while keeping `extensions/cli-shell` read-only.

## Third Rework Trigger: Selection Ownership And Dual-Layer Resize 2026-05-29

Manual acceptance after `d277bb79` clarified two remaining platform-law failures and one still-open shared-button law:

- Shell selection is still unreliable because selection gesture/state is still interpreted partly by the Shell/OpenTUI frame layer. The user explicitly restated that Shell selection cannot be owned at the Shell view layer because that layer cannot correctly own scroll semantics.
- Help/Chat statusbar actions still do not visually apply the shared active-state law the same way Chat titlebar actions do.
- Button active state still decorates the whole bracketed token instead of only the inner content.
- Terminal resize still needs the exact dual strategy the user restated in plain terms:
  1. bottom layer keeps a strict latest-only conflated resize law so even if one backend resize takes a long time, stopping the drag only leaves at most one final resize to process;
  2. top layer adds a separate `200ms` debounce so unnecessary resize sends are suppressed before they even reach the bottom-layer queue.

This third rework keeps the existing architecture decisions:

- `extensions/cli-shell` remains read-only reference material;
- terminal-specific law stays inside `extensions/shell-next`, not OpenCompose;
- OpenCompose remains terminal-agnostic;
- the rework is BDD-first and must include multi-round self-review aligned to the user's original wording;
- implementation is bounded to at most five explicit iteration rounds, with a final merged drift list and encountered-problems list.

## Fourth Rework Trigger: Button Click Law And Semantic Selection 2026-05-29

Manual acceptance after the third rework closed resize, but it found that several interaction laws are still wrong in the real shell-next product path:

1. `resize通过了`
2. `help/chat这组按钮仍然没有“激活态”的样式（下划线）`
3. `我发现所有的Button的click事件绑定不对，click需要是mousedown+mouseup，而不是现在只判断了mousedown`
4. `Shell的Selection问题仍然没有解决`
5. `发现一个新问题，Shell的双击应该要能选中文本，三击要能选中行。目前看到的效果是选中但是马上被取消选中了。所以我判断，你仍然在Shell-Next这边对Terminal做了太多事情，不够纯粹。这些都应该属于底层ghostty-native(vt)-backend的一些行为逻辑，属于底层内核，不该上升到 Shell-Next这一层。`

This fourth rework keeps the current architecture direction but tightens two laws:

- shared shell-next Buttons must commit actions on `mouseup` after a matching `mousedown`, instead of firing on press-down;
- ShellPane semantic double/triple click selection must stay backend-owned and must not be immediately cleared by a Shell-view drag-selection lifecycle.

The rework stays inside `extensions/shell-next` and OpenSpec artifacts. `extensions/cli-shell` remains read-only reference material.
