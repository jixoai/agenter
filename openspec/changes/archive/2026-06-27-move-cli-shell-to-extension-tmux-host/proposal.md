> Superseded note:
> This change remains useful as historical evidence for moving cli-shell into `apps/cli-shell`.
> Its architecture assumptions about tmux replacing TerminalSystem participation are superseded by `realign-cli-shell-with-core-system-boundaries`.

## Why

The current cli-shell implementation accidentally turned an extension app into a TerminalSystem-derived app surface by coupling cli-shell to `terminal-2` and composed terminal metadata. That violates the app boundary: TerminalSystem and cli-shell are independent products, and cli-shell must be removable without changing core terminal law.

This change makes the boundary explicit and destructive: cli-shell moves to `apps/cli-shell`, hosts its own terminal composition through tmux, and stops creating TerminalSystem app terminals as its visible surface.

## What Changes

- Move `agenter-app-shell` from `packages/cli-shell` to `apps/cli-shell`. **BREAKING**
- Add `apps/*` as a first-class workspace app root for local-first app command resolution. **BREAKING**
- Change `agenter shell` workspace resolution so extension packages are found without app-specific path branches. **BREAKING**
- Replace cli-shell's `terminal-1` / `terminal-2` / composed TerminalSystem runtime with an extension-local tmux host. **BREAKING**
- Keep MessageRoom and Avatar bootstrap through generic app-extension/client-sdk APIs. **BREAKING**
- Remove cli-shell's visible-terminal bootstrap from TerminalSystem; TerminalSystem no longer sees cli-shell's tmux panes as app-specific terminal roles. **BREAKING**
- Make cli-shell cleanup cover extension-owned tmux sessions plus generic MessageRoom/runtime resources, while treating old TerminalSystem resources as legacy residue only. **BREAKING**
- Add BDD tests proving cli-shell no longer creates `:terminal-2`, no longer publishes composed surfaces, and launches a tmux session with terminal and room panes.
- Add cross-platform compile scripts for at least `windows-amd64`, `linux-amd64`, and `macos-arm64`; Windows may compile while reporting a clear runtime tmux requirement.
- Deliver a legacy residue/risk audit documenting old terminal-2/composed-surface leftovers and safe cleanup order.

## Capabilities

### New Capabilities

- `cli-shell-tmux-host`: Defines cli-shell's extension-local tmux host, pane topology, lifecycle, cleanup, and runtime tmux dependency.
- `extension-app-layout`: Defines first-class extension workspace roots and app command resolution outside core packages.

### Modified Capabilities

- `cli-shell-app`: Replaces the terminal-2/composed-TerminalSystem app law with tmux-hosted cli-shell app law.
- `app-command-launcher`: Changes local-first resolution from package-only lookup to app workspace roots including `apps/*`.
- `app-runtime`: Clarifies that generic extension APIs do not imply app-specific TerminalSystem roles or composed terminal metadata.
- `runtime-terminal-contract`: Clarifies that TerminalSystem does not host cli-shell's tmux composition or app-local pane topology.

## Impact

- `package.json`
- `pnpm-workspace.yaml`
- `packages/cli/src/app-command-launcher.ts`
- `packages/cli/test/app-command-launcher.test.ts`
- `packages/app-runtime/test/app-runtime.test.ts`
- `apps/cli-shell/**/*`
- `openspec/specs/cli-shell-app/spec.md`
- `openspec/specs/app-command-launcher/spec.md`
- `openspec/specs/app-runtime/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- legacy cli-shell docs/specs that still mention `terminal-2`, composed surface publication, or TerminalSystem-derived app roles
