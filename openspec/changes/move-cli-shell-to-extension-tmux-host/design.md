> Superseded note:
> This design preserves useful historical context for the package move and tmux adoption.
> Its architecture conclusion that TerminalSystem is not a participant in active cli-shell runtime is superseded by `realign-cli-shell-with-core-system-boundaries`.

## Context

The existing cli-shell code path used TerminalSystem as a product compositor. It created a shell terminal, created a visible `terminal-2`, marked it with `terminalRuntimeKind: "composed"`, and published cli-shell chrome through `publishGlobalTerminalComposedSurface(...)`.

That implementation is now rejected. The important architectural fact is not that terminal composition is impossible; it is that cli-shell is the wrong owner for TerminalSystem laws. TerminalSystem should expose terminal primitives. cli-shell should compose its own product experience as an extension.

## Architecture Decision

### Option A: Extension-local tmux host

Chosen.

cli-shell becomes an extension-local terminal product:

- `extensions/cli-shell` owns cli-shell grammar, UI, tmux process topology, room pane, cleanup, and distribution scripts.
- tmux is the host/compositor for the cli-shell terminal product.
- MessageRoom remains a generic backend resource created through product-extension APIs.
- AvatarRuntime remains Avatar-scoped and is started through generic product-extension APIs.
- TerminalSystem is not used to create cli-shell's visible terminal, internal pane, or composed product surface.
- Core CLI only launches a descriptor-defined product package and passes daemon/auth context.

In plain terms: cli-shell may use Agenter backend systems for room/avatar/attention, but the terminal window that the user sees is tmux's business, not TerminalSystem's business.

### Option B: Keep terminal-2 and patch performance/interaction

Rejected.

Keeping terminal-2 would preserve the wrong product physics: cli-shell would keep requiring TerminalSystem to understand a cli-shell-specific final product terminal role. That creates exactly the kind of core/product coupling this platform is meant to avoid.

## Product Topology

For `agenter shell --session=5 --avatar=bangeel`:

1. Core CLI resolves product command `shell` to `agenter-ext-shell`.
2. Local-first launcher searches `extensions/cli-shell` before installed/remote packages.
3. cli-shell bootstraps the selected AvatarRuntime and MessageRoom through generic APIs.
4. cli-shell starts or attaches a tmux session named from the product session key.
5. tmux pane 0 runs the user's shell in the requested workspace.
6. tmux pane 1 runs `agenter-cli-shell room --session=5 --avatar=bangeel`.
7. The foreground process attaches the user to that tmux session.

The room pane is allowed to talk to MessageRoom. The shell pane is ordinary tmux shell state. TerminalSystem is not a participant in this topology.

## Boundary Law

The platform law added here is small:

- Workspace products may live under `extensions/*`.
- Product command resolution may discover extension packages by package descriptor, not by hard-coded product implementation imports.
- Product packages may use generic backend APIs.
- Product packages may not make core TerminalSystem data structures carry product-specific terminal roles.

cli-shell-specific law stays in `extensions/cli-shell`.

## Tmux Runtime Contract

tmux is treated as an external runtime dependency:

- The executable name defaults to `tmux`.
- The executable can be overridden for tests and custom installs.
- If tmux is missing, cli-shell fails with a clear message.
- Cross-platform binaries may compile for Windows, but the Windows runtime path is allowed to report that tmux is required rather than pretending to provide a native Windows terminal multiplexer.

tmux command construction is modeled as data before execution so BDD tests can verify pane topology without launching a real tmux server.

## Cleanup Contract

Cleanup is intentionally layered:

1. Kill extension-owned tmux sessions matching cli-shell metadata/name.
2. Delete generic MessageRoom resources owned by cli-shell.
3. Clear Avatar runtime sessions only when the cleanup command targets all cli-shell sessions or an explicit clear path requires it.
4. Do not create new TerminalSystem cleanup obligations for the new architecture.
5. Old `terminal-1` / `terminal-2` resources are legacy residue. The cleanup command may remove them for migration, but no new runtime path may depend on them.

## Distribution

The extension package owns executable builds:

- `build:binary:macos-arm64`
- `build:binary:linux-amd64`
- `build:binary:windows-amd64`
- `build:binary`

The compiled artifact is the cli-shell product binary. Runtime success still depends on a local tmux executable.

## Residue Strategy

The migration is destructive but not blind. Old OpenTUI/Web/composed TerminalSystem code is moved out of the active runtime path or deleted from the package test surface. A dedicated audit document lists each surviving old concept, whether it is safe to delete, and what would break if removed too early.
