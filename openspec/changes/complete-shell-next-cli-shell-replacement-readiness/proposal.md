# Complete shell-next replacement readiness

## Why

`shell-next` already proves the OpenTUI mux/layout host and live terminal projection path, but the current implementation still contains product-surface and event-routing gaps. The correction for this stage is to stop treating `cli-shell` as a runtime dependency. Shell-next may copy proven Room, bootstrap, settings, heartbeat, approval, and terminal projection code during incubation, but the copied code must become shell-next-owned code with shell-next/opencompose naming. The durable boundary is: shell-next replaces tmux as the local compositor and remains removable from legacy cli-shell.

## What Changes

- Localize the proven Room, product bootstrap, heartbeat, approval, and terminal projection atoms under `extensions/shell-next` instead of importing `agenter-ext-shell`.
- Incubate the compositor as `opencompose` inside shell-next: layout, pane chrome, pane title, focus, resize, and renderer mixing stay product-agnostic.
- Support two pane content families: OpenTUI renderer/renderable mixing and custom/terminal renderer content used by PTY + termless + ghostty-native projection.
- Route keyboard input through a DOM-tree-like focus path so top-layer, focused pane, and global host controls cannot all consume the same key.
- Model terminal creation through an explicit source policy so product-attached terminals and local BunPTY terminals are separate capabilities.
- Preserve `agenter shell2` as the validation entry and leave stable `agenter shell` unchanged.

## Impact

- Affects `extensions/shell-next` and the `packages/cli` descriptor needed for the local-only `agenter shell2` entry.
- Does not modify `extensions/cli-shell`; copied code is allowed, runtime imports are not.
- Does not rename packages, publish shell-next, or switch the stable shell command.
