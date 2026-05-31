# Design

## Platform Diagnosis

The accepted Shell is not a native tmux/psmux addon. The correct direction is an embedded OpenTUI compositor: shell owns pane layout, pane chrome, focus, overlays, renderer mixing, and terminal projection mounting.

The earlier "reuse cli-shell app atoms" framing is now a documented deviation. `cli-shell` is legacy and has moved to `apps/shell-old`. Shell may preserve copied behavior, but it must not import `agenter-app-shell-old` or `apps/shell-old` at runtime and must not preserve legacy naming in the new architecture.

Therefore the correct architecture is:

- `shell` owns localized app atoms copied from cli-shell where useful: Room, bootstrap, settings, heartbeat, approval, cleanup, and terminal projection.
- `opencompose` is incubated inside shell as the app-agnostic compositor law: layout, pane focus, pane chrome, terminal frame display, renderer-pane display, and resize.
- App attach uses shell-owned Room code. It does not mount or import the cli-shell Room atom.
- The stable `agenter shell` route now resolves to the new Shell package; the incubation-only `shell2` route is removed.

## Key Decisions

1. Copy proven cli-shell code, then own it

   The old Room implementation already solved multiline composer, history panel, room hydration, live repaint, send/refresh separation, and approval detection. Shell keeps that copied behavior inside `apps/shell/src/app-room` and evolves it under shell naming. Runtime imports from `agenter-app-shell-old` or `apps/shell-old` are forbidden because shell-old is preserved legacy.

2. Terminal source policy must be explicit

   App attach gives the first pane a live TerminalSystem source through a app-bound terminal source policy. Local mode gives panes a BunPTY-backed source policy. These are different capabilities, not fallback levels. Until app-bound split is implemented, the app-bound policy simply does not expose a split creator, so the host can show a visible "split unavailable" status without creating a different terminal truth.

3. opencompose is the local compositor law

   The shell compositor is incubated as `src/opencompose` plus `src/renderable-mux`. It is not extracted yet. Its pane API must support both OpenTUI renderer/renderable mixing and custom renderer content. Shell then uses that custom renderer path for PTY + termless + ghostty-native(vt)-backend projection.

4. View grammar is singular; management commands stay separate

   `shell` view selection is one attach-time choice, not a family of positional subcommands. The runtime grammar should therefore converge to `--view=none|room|help|status|shell`, where `none` is the default mixed-view host mode. `status` means a single-view projection of the statusbar inline-start summary, not the approval top-layer. Non-view management operations such as `cleanup` stay as their own command because they operate on app-owned resources rather than opening a mux surface.

5. Statusbar is macro-only and action-oriented

   Bottom statusbar no longer mirrors Heartbeat preview prose. It shows only macro runtime/attention facts on the left and available AI context usage on the right side of the summary band. `Help` and `Chat` are explicit action targets, not inert text.

6. Overlay is one plane, not separate ad-hoc dialogs

   Approval and close-confirm both live in the same top-layer overlay plane. `--view=status` never implies overlay. Pane close uses overlay confirmation with two app actions: keep PTY alive and close the UI, or kill PTY and close the UI. The top-layer must participate in the shared focus event path; it must not install a parallel global key listener.

7. Terminal pane title is source truth

   Terminal pane headers must read terminal title metadata from the terminal source. Precedence is `currentTitle ?? configuredTitle ?? source identity`. `shell` should not invent placeholder titles once source truth exists.

8. Prefix keymap belongs to the host law

   Shell host controls converge under `Ctrl+B` prefix. MVP bindings are `Ctrl+B H|?` for Help, `Ctrl+B C` for Chat, and `Ctrl+B Q` for close/quit flow. This keeps host control distinct from terminal raw input.

9. Terminal projection must reuse proven cli-shell truth

   Shell terminal panes continue to use the copied terminal mirror and backend framebuffer renderable path. Paint commitment must flow back to the mirror, otherwise live projection can stall into a black pane even when snapshots exist.

10. Event dispatch follows a focus tree

   Keyboard events route through a DOM-like focusable node tree. Root host law receives capture/bubble phases, while top-layer and pane content are target nodes. Pane-scope handlers may consume Esc, composer keys, and renderer-pane copy/paste without leaking to global shortcuts. Host controls use `Ctrl+B` prefix capture, so bare terminal chords remain terminal input instead of being stolen by the host.

11. Testing standard stays local-first

   Default shell tests use OpenTUI `createTestRenderer` plus terminal protocol source fakes and termless/ghostty-backed projection tests where needed. Native tmux may be used only as an optional parity harness for layout behavior, and any harness must create unique sessions and destroy them in cleanup.

12. openmux is reference material, not a dependency

   `openmux` is MIT and useful reference material for pane border/title, focus routing, terminal mouse handling, and resize batching. It remains a tmux-like C/S app rather than shell's target architecture, so shell only borrows design ideas and keeps the lightweight embedded layout+pane model. Future extraction name is `opencompose`.
