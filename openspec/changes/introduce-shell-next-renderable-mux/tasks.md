## 1. Scaffold And Launcher Boundary

- [x] 1.1 Create `extensions/shell-next` with package metadata for local workspace package `agenter-ext-shell-next`, bin `agenter-shell-next`, TypeScript config, and test/typecheck scripts.
- [x] 1.2 Add a minimal shell-next CLI entry that can parse `shell2` incubation argv without importing cli-shell tmux host code.
- [x] 1.3 Register `shell2` in the product command launcher as local-only descriptor metadata for `agenter-ext-shell-next`.
- [x] 1.4 Add launcher tests proving `shell2` resolves locally, refuses remote fallback, and leaves `shell -> agenter-ext-shell` unchanged.

## 2. Renderable Mux And Layout Core

- [x] 2.1 Create product-free `renderable-mux` core modules for pane ids, source ids, focus state, normalized mux commands, and input events.
- [x] 2.2 Implement `RootLayout` as the root layout context/document for shell-next surfaces.
- [x] 2.3 Implement `ChildLayoutNode` state for split axis, child weights, pane/renderable source id, assigned rectangle, and focus metadata.
- [x] 2.4 Inspect and pin the tmux source revision used for layout minimum-size parity, including `PANE_MINIMUM` plus separator/scrollbar/border costs.
- [x] 2.5 Implement tmux-like split operations for left/right/above/below with source-backed minimum pane dimension guards.
- [x] 2.6 Implement close-node, host-resize recomputation, geometry hit testing, and adjacent focus movement.
- [x] 2.7 Add BDD unit tests for split, close, resize, focus, minimum size, and hit testing behavior.
- [x] 2.8 Add tmux-source parity tests for minimum pane sizing so shell-next does not rely on an unexplained local magic number.
- [x] 2.9 Add a boundary test proving renderable mux/layout core modules do not import product, daemon, MessageRoom, TerminalSystem, Avatar, attention, or tmux host modules.

## 3. Pane Source Protocol Boundary

- [x] 3.1 Define the abstract pane source union consumed by shell-next: terminal protocol channel source, Bun PTY source, CommandTask source, and optional OpenTUI renderable source.
- [x] 3.2 Define the normalized terminal protocol channel adapter contract for frame read/update, input write, resize, viewport events, dirty/pull pacing, lifecycle, and dispose.
- [x] 3.3 Implement or stub the direct protocol-channel source path so an existing terminal protocol channel can back a pane without creating another terminal truth.
- [x] 3.4 Implement or stub the Bun PTY adapter path: launch `Bun.Terminal`, feed output into offscreen Termless/Ghostty VT, and expose the normalized protocol channel.
- [x] 3.5 Implement or stub the CommandTask adapter path by lowering CommandTask launch into the Bun PTY source path.
- [x] 3.6 Record the optional OpenTUI renderable source contract separately from terminal protocol channels, so non-terminal surfaces can be mixed into layout without pretending to be VT panes.
- [x] 3.7 Build a four-pane OpenTUI renderable mixing demo that mounts four independent renderable surfaces under one root renderer into shell-next panes.
- [x] 3.8 Verify and record click/selection behavior in the four-pane mixing demo; user verified `bun run agenter shell2 renderer-grid-demo` as working perfectly.
- [x] 3.9 Add BDD tests proving protocol channel, Bun PTY, and CommandTask sources all reach `PaneRenderable` through the same normalized terminal source shape.

## 4. OpenTUI Renderable API

- [x] 4.1 Implement `PaneRenderable` on OpenTUI low-level APIs, using backend-owned cell/cursor/viewport facts and stable layout-assigned geometry.
- [x] 4.2 Ensure `PaneRenderable` does not own split/focus/resize layout, does not create PTY/CommandTask/TerminalSystem resources, and does not parse ANSI bytes.
- [x] 4.3 Implement a root/mux renderable that mounts child renderables from `RootLayout`, routes key/mouse/resize events, and applies layout rectangles.
- [x] 4.4 Keep selection/copy out of MVP acceptance; leave TODO/FIXME only where future backend-owned terminal interaction events should attach.
- [x] 4.5 Add OpenTUI test-renderer coverage for pane projection, focus styling, resize propagation, layout hit routing, and source disposal.
- [x] 4.6 Record performance/debug hooks for frame replay timing without coupling the renderable API to a product logger.

## 5. Product Wiring And Reuse

- [x] 5.1 Classify cli-shell reuse candidates into safe product/projection/OpenTUI surface atoms and tmux-host residue before copying or importing code.
- [x] 5.2 Reuse or adapt cli-shell argument parsing, bootstrap/client-sdk binding, settings, terminal input encoding, and live terminal mirror concepts through shell-next-local boundaries.
- [x] 5.3 Wire `agenter-shell-next` startup to create one initial shell pane through the selected source adapter and render it through the mux surface.
- [x] 5.4 Add shell-next behavior tests for startup, focused input routing, split command, focus movement, and resize propagation.

## 6. Product Surfaces And Statusbar

- [x] 6.1 Adapt existing cli-shell Help surface as an OpenTUI renderable/overlay without tmux popup assumptions.
- [x] 6.2 Adapt top-layer approval surface as product wiring above or inside the layout root without tmux status/action dispatch.
- [x] 6.3 Classify Room/source integration from the four-pane mixing demo result: direct OpenTUI renderable sources and BunPTY/protocol terminal sources are independent paths selected by source nature, not fallback levels.
- [x] 6.4 Implement an OpenTUI-native statusbar in MVP.
- [x] 6.5 Migrate Studio Heartbeat's macro summary derivation for runtime status and AttentionContext focus counts, producing summaries such as `Idle · 21 focused · 2 background · 2 muted`.
- [x] 6.6 Migrate AI context usage summary/progress for the statusbar, producing compact output such as `0.7%` when usage and max context are available.
- [x] 6.7 Add statusbar tests proving AttentionItem content is not rendered and only macro AttentionContext/AI context facts are shown.
- [x] 6.8 Add narrow-width statusbar tests proving right-side Help/Chat actions remain visible while the left macro summary truncates by importance order.

## 7. Verification And Acceptance

- [x] 7.1 Run `openspec validate introduce-shell-next-renderable-mux --strict`.
- [x] 7.2 Run focused launcher, shell-next, and reused cli-shell test suites.
- [x] 7.3 Run typecheck for `packages/cli`, `extensions/shell-next`, and any touched cli-shell shared modules.
- [x] 7.4 Manually smoke-test `bun agenter shell2` in a real terminal for startup, split/focus, resize, statusbar, and exit cleanup.
- [x] 7.5 Keep current `bun agenter shell` tmux-backed behavior available and record side-by-side acceptance notes before any future rename.

## 8. Product Completion And Projection Reuse

- [x] 8.1 Treat sections 1-7 as mux/layout foundation acceptance, not final shell-next product completion.
- [x] 8.2 Add a product-free terminal pane factory extension point so renderable mux does not hardcode the plain text terminal projection.
- [x] 8.3 Add a shell-next product adapter that reuses cli-shell's `BackendTerminalFrameRenderable` / `ShellTerminalViewRenderable` / `FrameBufferRenderable` projection stack for terminal panes.
- [x] 8.4 Extend local BunPTY protocol snapshots with rich-line, cursor, viewport, and scrollback facts from Termless/Ghostty so the FrameBuffer adapter consumes backend-owned terminal truth.
- [x] 8.5 Keep Help and Chat as visible OpenTUI-native product actions/surfaces in the shell2 runtime.
- [x] 8.6 Add or update BDD tests proving shell-next uses the frame-backed projection path, routes terminal input through the focused pane, and keeps Help/Chat visible.
- [x] 8.7 Re-run OpenSpec, shell-next tests, launcher tests, and shell-next typecheck after the product-completion fixes.
