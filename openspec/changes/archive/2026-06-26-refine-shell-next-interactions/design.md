## Context

Shell-next currently owns an embedded OpenTUI mux with pane layout, pane chrome, top-layer overlay, renderer-pane mixing, and terminal projection. The latest acceptance pass showed that the architecture is directionally correct, but interaction details are still implemented as local choices instead of platform rules.

The important platform boundary is:

- `renderable-mux` / `opencompose` define reusable compositor laws: pane chrome, hit regions, resize handles, layout sync, and source-agnostic pane mounting.
- app surfaces such as Chat and Help provide content and surface actions, but do not invent separate button or hit-test behavior.
- terminal projection owns expensive backend resize delivery, because only terminal panes know which layout changes affect PTY/VT dimensions.

## Goals / Non-Goals

**Goals:**

- Make bracketed button styling a reusable shell-next affordance primitive.
- Use underline for active actions and bold for hover actions in pane-title and statusbar contexts.
- Make resize handles support both click and drag.
- Coalesce terminal backend resize requests so layout drag does not overload the terminal renderer/backend.
- Align close-confirm hit regions with visible cells.
- Cover ShellPane and renderer-pane copy behavior with BDD tests.
- Keep all implementation under `apps/shell-next`.

**Non-Goals:**

- Extract `opencompose` into a published package.
- Modify `apps/cli-shell`.
- Replace the existing terminal backend, OpenTUI renderer, or room implementation.
- Add tmux/psmux/native addon paths.

## Decisions

1. Button chrome becomes a small typed primitive

   Pane-title actions already flow through `pane-chrome.ts`, so this change extends that law instead of adding per-surface glyph swaps. An action keeps one stable label; state is expressed by style metadata. Statusbar actions use the same bracketed label builder so hover and active state do not diverge.

   Alternative considered: let Chat and statusbar continue rendering ad-hoc strings. That keeps the immediate patch small but preserves the drift that caused `[Help] [Chat]` and Chat title actions to behave differently.

2. Click resize is modeled as a resize handle action, not as layout special casing

   The resize controller already computes handles from adjacent panes. The click behavior belongs there: pointer down starts possible drag, pointer up without drag applies one-cell delta. This keeps layout pure and lets future vertical/horizontal containers reuse the same controller.

   Alternative considered: expose direct `resizeLeftPane()` helpers from app Room. That would couple app surfaces to pane geometry and break the embedded compositor boundary.

3. Terminal backend resize is debounced inside terminal panes

   Layout changes may be high frequency, but terminal pane `syncNode()` knows the sanitized terminal cols/rows and can compare pending sizes. The pane should update its local frame size immediately for visual feedback, while backend `source.resize()` is debounced and coalesced to the newest size.

   Alternative considered: debounce `mux.syncLayout()`. That would make OpenTUI visuals lag during drag and would also delay non-terminal panes that are cheap to resize.

4. Top-layer hit tests use the same coordinate space as visible renderables

   Close-confirm action regions should be computed from the root position plus child local position. BDD tests must locate visible button text in the captured frame and click those exact cells, then assert the row above does not trigger the action.

   Alternative considered: keep fixed test coordinates. That already hid the one-row offset and is not a stable behavioral contract.

5. Copy behavior remains source-family specific

   Terminal-protocol panes route selection and copy through the terminal source because the source owns VT selection truth. Renderer panes use OpenTUI renderer selection and OSC52 mirroring. The app host coordinates shortcuts and primary-selection mirroring but does not merge the two selection models into one fake abstraction.

## Risks / Trade-offs

- OpenTUI text title styling may not support independent ANSI styles inside a border title. Mitigation: expose style state in tests and use the least invasive runtime representation available; if native title styling is unavailable, keep stable labels and preserve state in structured builders for future renderer support.
- Mouse selection primary behavior may still depend on terminal emulator support for OSC52 primary. Mitigation: assert shell-next emits primary OSC52 requests and avoid handling middle click locally so OS/terminal behavior remains outside shell-next.
- Debounced terminal resize can briefly leave backend size behind visual size during rapid drag. Mitigation: frame size updates immediately, backend receives only the final coalesced size within a short interval.
