## Why

Manual acceptance has narrowed the remaining `shell-next` failures to one architecture mistake: terminal interaction behavior is still split across multiple layers. Statusbar active state was already fixed by separating local UI facts from runtime status facts. The next failures are deeper:

- Shell selection is still unreliable because gesture and semantic selection handling are still partly interpreted in the Shell/OpenCompose view path.
- The Shell view is not the right place to own scroll-aware selection truth.
- Semantic double-click word selection and triple-click line selection are not generic pane behavior; they are terminal/content-specific behavior and, for renderer panes, should be an explicit opt-in plugin rather than a default pane law.

The user restated the target law in plain terms:

1. terminal-specific input/selection behavior must collapse to one lower layer, `termless + ghostty-native(vt)-backend` / shell-next internal kernel, even if that means temporarily disabling higher-layer behavior;
2. OpenCompose and pane composition stay generic;
3. `cliRenderer` panes may opt into a `useMouseSelectionBehavior(cliRenderer)`-style extension, but custom-render panes must not inherit double/triple-click selection semantics by default.

This change exists to turn that architecture boundary into explicit app law before more local fixes pile up on top of the wrong layer.

## What Changes

- Define one shell-next Terminal Interaction Kernel boundary that owns terminal-specific input, selection, semantic selection, scroll-aware gesture state, copy, paste, and viewport-follow behavior for custom terminal panes.
- Remove remaining durable selection/semantic selection ownership from Shell/OpenCompose view code; that layer becomes a raw event adapter plus visual projector only.
- Define renderer-pane mouse selection semantics as an explicit opt-in plugin contract instead of a default pane/runtime law.
- Add BDD scenarios that reproduce the current Shell selection drift and prove the new ownership boundary.
- Keep `apps/cli-shell` read-only and use `legacy/terminal2` only as behavior reference material.
- Record multi-round self-review directly against the user's original wording so implementation does not drift back into app-layer patches.

## Capabilities

### New Capabilities

- `shell-next-terminal-interaction-ownership`: shell-next terminal interaction ownership laws for backend-owned terminal panes and opt-in renderer selection plugins.

### Modified Capabilities

- `shell-next-interaction-stability`: active after this change, it depends on the lower-layer ownership law rather than app-layer event patches.

## Impact

- Affects `packages/termless-core` terminal host-input law, `apps/shell-next` terminal projection, live terminal source/mirror, renderer-pane integration points, and tests.
- Adds OpenSpec artifacts under `openspec/changes/rework-shell-next-terminal-interaction-ownership`.
- Does not modify `apps/cli-shell`.
- Does not promote terminal behavior into OpenCompose or a published `opencompose` package.
- Does not change stable `agenter shell`; work remains behind `agenter shell2`.
