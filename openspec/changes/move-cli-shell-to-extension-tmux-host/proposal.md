> Superseded note:
> This change remains useful as historical evidence for moving cli-shell into `extensions/cli-shell`.
> Its architecture assumptions about tmux replacing TerminalSystem participation are superseded by `realign-cli-shell-with-core-system-boundaries`.

## Why

The current cli-shell implementation accidentally turned an extension product into a TerminalSystem-derived product surface by coupling cli-shell to `terminal-2` and composed terminal metadata. That violates the product boundary: TerminalSystem and cli-shell are independent products, and cli-shell must be removable without changing core terminal law.

This change makes the boundary explicit and destructive: cli-shell moves to `extensions/cli-shell`, hosts its own terminal composition through tmux, and stops creating TerminalSystem product terminals as its visible surface.

## What Changes

- Move `@agenter/cli-shell` from `packages/cli-shell` to `extensions/cli-shell`. **BREAKING**
- Add `extensions/*` as a first-class workspace product root for local-first product command resolution. **BREAKING**
- Change `agenter shell` workspace resolution so extension packages are found without product-specific path branches. **BREAKING**
- Replace cli-shell's `terminal-1` / `terminal-2` / composed TerminalSystem runtime with an extension-local tmux host. **BREAKING**
- Keep MessageRoom and Avatar bootstrap through generic product-extension/client-sdk APIs. **BREAKING**
- Remove cli-shell's visible-terminal bootstrap from TerminalSystem; TerminalSystem no longer sees cli-shell's tmux panes as product-specific terminal roles. **BREAKING**
- Make cli-shell cleanup cover extension-owned tmux sessions plus generic MessageRoom/runtime resources, while treating old TerminalSystem resources as legacy residue only. **BREAKING**
- Add BDD tests proving cli-shell no longer creates `:terminal-2`, no longer publishes composed surfaces, and launches a tmux session with terminal and room panes.
- Add cross-platform compile scripts for at least `windows-amd64`, `linux-amd64`, and `macos-arm64`; Windows may compile while reporting a clear runtime tmux requirement.
- Deliver a legacy residue/risk audit documenting old terminal-2/composed-surface leftovers and safe cleanup order.

## Capabilities

### New Capabilities

- `cli-shell-tmux-host`: Defines cli-shell's extension-local tmux host, pane topology, lifecycle, cleanup, and runtime tmux dependency.
- `extension-product-layout`: Defines first-class extension workspace roots and product command resolution outside core packages.

### Modified Capabilities

- `cli-shell-product`: Replaces the terminal-2/composed-TerminalSystem product law with tmux-hosted cli-shell product law.
- `product-command-launcher`: Changes local-first resolution from package-only lookup to product workspace roots including `extensions/*`.
- `product-extension-runtime`: Clarifies that generic extension APIs do not imply product-specific TerminalSystem roles or composed terminal metadata.
- `runtime-terminal-contract`: Clarifies that TerminalSystem does not host cli-shell's tmux composition or product-local pane topology.

## Impact

- `package.json`
- `pnpm-workspace.yaml`
- `packages/cli/src/product-command-launcher.ts`
- `packages/cli/test/product-command-launcher.test.ts`
- `packages/product-extension-runtime/test/product-extension-runtime.test.ts`
- `extensions/cli-shell/**/*`
- `openspec/specs/cli-shell-product/spec.md`
- `openspec/specs/product-command-launcher/spec.md`
- `openspec/specs/product-extension-runtime/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- legacy cli-shell docs/specs that still mention `terminal-2`, composed surface publication, or TerminalSystem-derived product roles
