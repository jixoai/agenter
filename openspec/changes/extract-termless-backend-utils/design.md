## Architecture

`@agenter/termless-core` is the low-level terminal contract boundary. It may define backend interaction contracts such as selection ranges, pointer coordinates, interaction capabilities, and adapters that expose backend-owned state. It must not decide which host keyboard or mouse behaviors every backend receives.

`@agenter/termless-backend-utils` is an opt-in utility package. It depends on `@agenter/termless-core` types and composes against a target that implements the core interaction contract plus write/follow-cursor hooks. It is not a backend, not a backend registry, and not the durable authority for terminal identity.

This keeps the composition shape explicit:

```ts
import { createTerminalHostInputController } from "@agenter/termless-backend-utils";

const hostInput = createTerminalHostInputController({
  keyboard: { keyEncoding: true, wordNavigation: true, keyboardSelection: true },
  pointer: { dragSelection: true, semanticSelection: true },
});
```

A future complete backend can ignore the utility entirely. A partial backend can opt into only the pieces it lacks.

## Composition Law

The package exposes utilities as small controllers with feature switches. Defaults preserve the current shell-next behavior for existing consumers, but each feature can be disabled:

- `keyboard: false` disables all keyboard/paste handling.
- `keyboard.keyEncoding: false` disables normal key-to-byte encoding.
- `keyboard.wordNavigation: false` disables Option/meta word movement.
- `keyboard.keyboardSelection: false` disables Shift and Shift+Option range selection.
- `keyboard.clearSelectionOnInput: false` prevents plain input from clearing backend selection.
- `keyboard.followCursorOnInput: false` prevents accepted input from requesting follow-cursor.
- `pointer: false` disables all pointer selection handling.
- `pointer.dragSelection: false` disables drag selection.
- `pointer.semanticSelection: false` disables double-click word and triple-click line selection.
- `pointer.clearSelectionOnClick: false` prevents a plain click from clearing an existing selection.

Disabled features must become no-op/fallthrough paths. They must not mutate target state and must return `handled: false` / `preventDefault: false` for pointer events or `false` for keyboard/paste events.

## Package Boundary

`@agenter/termless-backend-utils` may import core terminal contracts from `@agenter/termless-core`. The dependency direction must not invert: `@agenter/termless-core` must not import or export `@agenter/termless-backend-utils`.

`shell-next` uses this package because shell-next currently composes a backend and needs host input policy. `extensions/cli-shell` remains read-only.

## BDD Strategy

BDD tests live with the new package and focus on observable composition behavior:

- default controller preserves semantic selection and keyboard movement behavior;
- disabling keyboard handling prevents writes, clears, and follow-cursor calls;
- disabling word navigation lets Option+Arrow fall through;
- disabling semantic pointer selection leaves double/triple click unhandled;
- disabling drag selection still permits semantic selection when enabled;
- disabling selection clearing or follow-cursor changes only that portion of the transaction.

Shell-next tests continue to prove product behavior, while the utility package proves reusable composition law.

## Self Review Checklist

- `core` exposes terminal contracts but no optional host input policy.
- `backend-utils` is an opt-in utility package, not backend authority.
- shell-next explicitly imports the utility package.
- no code imports from or edits `extensions/cli-shell`.
- disabled utility features do not mutate backend state.
