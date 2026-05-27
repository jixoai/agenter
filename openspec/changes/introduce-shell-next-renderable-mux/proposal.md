## Why

The current cli-shell uses tmux as the local pane host, which solved early native rendering performance issues but makes distribution depend on user-installed tmux/psmux and keeps the product shell architecture tied to an external compositor.

We need a local incubation surface for a better shell architecture: `extensions/shell-next` will prototype an embedded tmux-like layout runtime on top of OpenTUI low-level Renderable/layout APIs, while preserving enough cli-shell product/runtime code to keep the experiment grounded in existing behavior.

## What Changes

- Add an `extensions/shell-next` incubation area for the next shell product implementation.
- Add a local-only `bun agenter shell2` launcher command that routes to shell-next during incubation.
- Model shell-next as an OpenTUI Renderable API family rather than a tmux command host; the first durable primitives are expected to be `PaneRenderable`, `RootLayout`, and `ChildLayoutNode`.
- Normalize terminal pane sources through the existing protocol channel; Bun PTY and CommandTask inputs become adapters into that channel, while optional OpenTUI renderable sources can mix into layout as non-terminal surfaces.
- Replace external tmux composition with an embedded renderable mux surface that can split, resize, focus, and compose multiple terminal panes or OpenTUI renderables inside one native TTY.
- Add an OpenTUI-native statusbar in MVP that mirrors Studio Heartbeat's macro runtime, AttentionContext outline, and AI context summary without rendering AttentionItem content.
- Reuse proven cli-shell atoms where they remain orthogonal: argument parsing patterns, product bootstrap/client-sdk binding, room/help/top-layer surfaces, terminal input encoding, live terminal mirror, settings, and tests where applicable.
- Do not rename existing `extensions/cli-shell` during this incubation. Stable rename is deferred: shell-next becomes shell only after acceptance, and current cli-shell becomes shell-legacy then.
- Do not publish shell-next while unstable; it is local workspace-only.
- Keep `shell2` distinct from existing `shell` so users and tests can compare old tmux-hosted behavior with the new renderable mux.

## Capabilities

### New Capabilities

- `shell-next-renderable-mux`: Shell-next shall provide an embedded tmux-like OpenTUI Renderable mux surface with pane layout, focus, resize, input routing, and reusable renderable APIs.

### Modified Capabilities

- `product-command-launcher`: The launcher shall expose a local-only `shell2` command for shell-next without changing the published `shell` command contract.
- `cli-shell-product`: The existing cli-shell product remains the stable tmux-hosted shell during incubation and shall not be renamed or behaviorally replaced by shell-next before acceptance.

## Impact

- New files under `extensions/shell-next/**`.
- Launcher descriptor updates under `packages/cli/src/product-command-registry.ts` and related launcher tests.
- Potential extraction/reuse from `extensions/cli-shell/src/**`, especially product/bootstrap, terminal renderable, room/help/top-layer TUI surfaces, terminal input, settings, and live terminal mirror code.
- OpenTUI low-level APIs become the incubation target for shell-next renderable composition.
- Terminal protocol channel adapters become the normalized pane source boundary for terminal panes.
- Studio Heartbeat statusbar derivation becomes the reference model for shell-next statusbar macro summaries.
- Existing `extensions/cli-shell` remains stable and continues to back `bun agenter shell`.
