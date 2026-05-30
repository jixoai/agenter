# Complete shell replacement readiness

## Why

The previous `shell-next` implementation has reached acceptance and should become the official Shell product. The old tmux-backed `cli-shell` remains as preserved legacy code only. The durable boundary is: `agenter shell` launches the OpenTUI/opencompose Shell product, while the old implementation is moved to `extensions/shell-old` and no longer owns the launcher command.

## What Changes

- Rename `extensions/shell-next` to `extensions/shell` and publish it as `agenter-ext-shell` / `agenter-shell` / `runShell`.
- Rename `extensions/cli-shell` to `extensions/shell-old` and keep it private so it cannot conflict with the official Shell package.
- Route `agenter shell` to the new Shell descriptor.
- Remove the `agenter shell2` product descriptor; `shell2` becomes an unsupported command.
- Incubate the compositor as `opencompose` inside shell: layout, pane chrome, pane title, focus, resize, and renderer mixing stay product-agnostic.
- Keep terminal creation behind the existing source policy so product-attached terminals and local BunPTY terminals remain separate capabilities.

## Impact

- Affects `extensions/shell`, `extensions/shell-old`, `packages/cli`, release bundle metadata, lockfiles, and shell-related tests/specs.
- Does not change TerminalSystem, MessageSystem, AttentionSystem, or LoopBus architecture.
- Removes the public `shell2` launcher surface.
