## Why

Native acceptance after `backend-owned-terminal-interaction` proved that cursor-follow and Option+Left/Right word navigation now work, but text selection still cannot be started in the real Ghostty/native shell. This blocks copy-oriented testing and shows that our automated drag tests do not cover the native mouse event path.

The same acceptance pass also surfaced normal terminal editing parity gaps: Home/End should move to line start/end, and Option+Shift+Left/Right should extend the backend-owned selection by word. These behaviors must be routed through the terminal interaction owner, not reintroduced as host-local selection truth.

## What Changes

- Fix native drag selection so real mouse down/drag/up events are routed to the shell or dialogue backend owner.
- Add debug traces that show whether native mouse lifecycle events reach the offscreen frame projection and whether they are routed to backend selection.
- Keep single-click non-selecting; a backend drag selection may start only after actual drag movement.
- Preserve backend-owned selection truth: OpenTUI may capture events and map coordinates, but selected text/range/overlay remain owned by backend owners.
- Add terminal editing parity for Home/End line movement.
- Add Option+Shift+Left/Right word-extend selection behavior using the same backend-aware word boundary law as Option+Left/Right and double-click word selection.
- Add BDD tests that fail if native-like mouse lifecycle routing, Home/End, or Option+Shift selection regress.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `terminal-screen-projection-law`: strengthen native OpenTUI mouse lifecycle routing, Home/End line navigation, and Option+Shift word selection requirements.
- `terminal-backend-interaction`: require backend interaction owners to support keyboard-driven selection extension where the app enables editing enhancements.
- `terminal-view-component`: require debug-visible native mouse event routing and shortcut routing without host-local selection truth.
- `cli-shell-interaction-capabilities`: require cli-shell recommendations/tests to cover Home/End and Option+Shift word selection parity.

## Impact

- `packages/cli-shell/src/tui/backend-frame-renderable.ts`
- `packages/cli-shell/src/tui/controller.ts`
- `packages/cli-shell/src/tui/terminal-input.ts`
- `packages/cli-shell/src/tui/live-terminal-mirror.ts`
- `packages/cli-shell/test/cli-shell-tui.test.ts`
- `packages/termless-core/src/terminal-interaction.ts`
- Terminal transport/control-plane interaction types if new semantic events are needed
- `packages/cli-shell/SPEC.md` if durable cli-shell laws need a summary update before archive
