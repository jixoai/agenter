## 1. Shell Host Surface

- [x] 1.1 Keep `--view=none|room|help|status|shell` as the singular view grammar, with `status` limited to inline-start status summary.
- [x] 1.2 Rebuild mixed-host statusbar so it shows only macro AttentionContext facts and AIContext usage.
- [x] 1.3 Make `Help` and `Chat` explicit clickable statusbar actions.

## 2. Pane Chrome And Overlay

- [x] 2.1 Surface terminal pane title from terminal source truth instead of synthetic `Shell pane-*` labels.
- [x] 2.2 Add pane close affordance in the terminal title bar.
- [x] 2.3 Generalize top-layer to handle both approval and close-confirm overlays.
- [x] 2.4 Route close-confirm actions to `Run in background` and `Terminate terminal`.

## 3. Input And Terminal Projection

- [x] 3.1 Reserve `Ctrl+B` as the shell host prefix and wire Help/Chat/quit MVP bindings.
- [x] 3.2 Default shell renderers to `useKittyKeyboard: { events: true }`.
- [x] 3.3 Keep terminal projection on the proven cli-shell mirror/framebuffer path and flow paint commitment back to the mirror to avoid black-pane stalls.
- [x] 3.4 Support renderer-pane host copy/paste and keep terminal-protocol copy behavior intact.

## 4. Verification

- [x] 4.1 Run `openspec validate complete-shell-next-cli-shell-replacement-readiness --strict`.
- [x] 4.2 Run focused shell tests.
- [x] 4.3 Run focused shell-old safety checks where needed.
- [x] 4.4 Run shell typecheck.
- [x] 4.5 Run `git diff --check`.

## 5. Follow-Up Pane Platform Repair

- [x] 5.1 Promote pane titles and close affordances into a reusable shell pane chrome API.
- [x] 5.2 Route terminal pane selection through the terminal protocol source and renderer pane copy through OpenTUI renderer selection.
- [x] 5.3 Fix close-confirm as an English top-layer dialog with border-owned title/actions and stable hit-test coordinates.
- [x] 5.4 Add scoped key consumption so dialog-level ESC cannot also close pane-level surfaces.
- [x] 5.5 Preserve PTY/OSC title projection and terminal cursor placement in shell framebuffer panes.
- [x] 5.6 Add focused BDD regressions and rerun OpenSpec/typecheck/test verification.

## 6. Architecture Correction After Review

- [x] 6.1 Update OpenSpec to state that shell copies/localizes cli-shell behavior instead of importing cli-shell.
- [x] 6.2 Keep `extensions/shell-old` untouched and add shell boundary checks for legacy imports/naming.
- [x] 6.3 Promote keyboard handling to a focus-path dispatcher: top-layer, focused pane, then global host controls.
- [x] 6.4 Add focused BDD regressions for pane-scope key consumption and top-layer single consumption.
- [x] 6.5 Record openmux as MIT reference material for layout/pane chrome/resize without adding it as a dependency.
- [x] 6.6 Rerun OpenSpec validation, shell tests, shell typecheck, shell-old focused safety tests, and diff checks.

## 7. Focus Tree And Geometry Hardening

- [x] 7.1 Replace the flat key dispatcher with a focusable node tree that supports capture, target, and bubble phases.
- [x] 7.2 Move host split/close/focus layout actions behind `Ctrl+B` prefix and forward bare terminal chords to the focused terminal source.
- [x] 7.3 Add BDD regressions for focus-tree phase order and key consumption.
- [x] 7.4 Add BDD regressions for terminal title close hit regions, close-confirm hit regions, and first-row terminal selection coordinates.
- [x] 7.5 Keep product attach statusbar macro-only by stripping Heartbeat preview labels and projecting available model-call context usage.
- [x] 7.6 Rerun OpenSpec validation, shell tests, shell typecheck, shell-old focused safety tests, and diff checks.

## 8. Final Shell Promotion

- [x] 8.1 Rename `extensions/shell-next` to `extensions/shell` and normalize package/bin/main export identity.
- [x] 8.2 Rename legacy `extensions/cli-shell` to `extensions/shell-old` and remove its package-name collision with `agenter-ext-shell`.
- [x] 8.3 Route `agenter shell` to the new Shell descriptor and remove the `shell2` descriptor.
- [x] 8.4 Update release bundle metadata, CLI tests, and shell tests for the final command surface.
- [x] 8.5 Rerun targeted verification and stale-reference checks.
