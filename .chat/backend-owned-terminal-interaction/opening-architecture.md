# Backend-Owned Terminal Interaction Opening Evidence

## Current Law

The terminal projection law is already moving in the right direction: cli-shell should draw backend-authored cells and route user intent back to the owning terminal backend. The remaining broken part is interaction ownership. Selection, copy, semantic selection, and cursor-follow must be backend/offscreen-renderer facts, not OpenTUI screen-local facts.

## Code Evidence

### Ghostty terminal-core already owns selection

`packages/ghostty-native/native/.ghostty-src/src/terminal/Screen.zig` exposes the important selection APIs:

- `select(self: *Screen, sel_: ?Selection)`
- `clearSelection(self: *Screen)`
- `selectionString(...)`
- `selectLine(...)`
- `selectWord(...)`

`packages/ghostty-native/native/.ghostty-src/src/terminal/Selection.zig` makes selection bounds trackable through `Selection.track(...)`, and `Screen.select(...)` tracks untracked selections before storing them.

The upstream test `Screen: scrolling moves selection` in `Screen.zig` proves the key behavior we need: a selected range follows screen/scrollback mutation because it is tied to tracked backend pins instead of frontend rows.

### The local ghostty-native wrapper does not expose selection yet

`packages/ghostty-native/native/src/main.zig` currently exports terminal lifecycle, feed, resize, reset, text/cell reads, cursor, scrollback, viewport scroll, and default colors.

`packages/ghostty-native/src/backend.ts` exposes the same JS backend surface. It currently has no shared interaction capability object and no methods for:

- clear selection
- select range
- select word
- select line
- copy selected text
- visible selection overlay/range

### OpenTUI currently owns too much selection state

`packages/cli-shell/src/tui/backend-frame-renderable.ts` still owns durable host-local selection fields:

- `#selection`
- `#dragSelection`
- `#semanticSelection`
- `#selectionOwner`

It also computes selected text locally through frame snapshots and implements `selectWordAt(...)` / `selectRowAt(...)` with OpenTUI-local text reads. That explains the manual failures where selection does not follow backend scrolling and semantic selection behavior drifts from native terminal behavior.

## Execution Direction

1. Add shared interaction contracts in `@agenter/termless-core`.
2. Expose backend-native interaction capabilities from Ghostty when available.
3. Add a generic backend-adapter-owned fallback for non-native owners.
4. Thread selection/copy/follow events through terminal transport/runtime.
5. Refactor OpenTUI to only capture events, map owner coordinates, and render backend-provided overlays.
