## Context

The previous backend-owned interaction change established the correct law: shell and dialogue selection truth belongs to backend/offscreen owners, while OpenTUI is only the native projection/event bridge. Manual acceptance now shows the law is incomplete in the real native path:

- text selection cannot be started at all in Ghostty/native shell;
- cursor-follow after input works;
- Option+Left / Option+Right word navigation works;
- Home/End and Option+Shift+Left/Right still need normal terminal editing parity.

Existing tests mostly exercise OpenTUI's idealized `mockMouse.drag` selection path. They prove that `BackendFrameRenderable.shouldStartSelection` can route a selection if OpenTUI global selection calls it, but they do not prove that real native mouse down/drag/up events are bridged into backend interaction messages.

## Goals / Non-Goals

**Goals:**

- Route native mouse down/drag/drag-end/up lifecycle events into backend-owned selection for shell and dialogue regions.
- Keep single-click from creating a selection.
- Keep selection owner bounded to the region where drag started.
- Add debug traces that make native mouse capture and backend selection routing visible with `--debug=selection`.
- Make Home/End move shell input to line start/end through backend-accepted terminal input.
- Make Option+Shift+Left/Right extend backend-owned selection by word using the same ICU/terminal-column boundary law as Option+Left/Right.
- Add BDD tests that cover renderable mouse lifecycle directly, not only OpenTUI `mockMouse.drag`.

**Non-Goals:**

- Do not make OpenTUI selected text or OpenTUI `Selection` the terminal truth.
- Do not add a second frontend-owned shell editor model.
- Do not change prompt seed files or unrelated cli-shell tests currently edited by the user.
- Do not require native Ghostty automation in Codex; final native acceptance remains user-run.

## Decisions

### 1. Bridge renderable mouse lifecycle directly, keep OpenTUI selection as auxiliary

`BackendFrameRenderable` will track a pending left-button press and start backend selection only after a real drag reaches a different owner coordinate. It will then send start/update/end to the backend owner and ignore cross-owner movement.

Rationale:

- OpenTUI exposes `onMouseDown`, `onMouseDrag`, `onMouseDragEnd`, and `onMouseUp`.
- Real terminals may deliver drag lifecycle in ways that do not reliably exercise OpenTUI's global `Selection` object.
- This preserves the user's rule: single click must not show selection; only real drag starts selection.

Rejected alternative:

- Depend only on `shouldStartSelection` / `onSelectionChanged`.
  - Rejected because current manual acceptance already shows that path is not sufficient for native Ghostty testing.

### 2. Cursor movement uses terminal input; selection extension uses backend selectRange

Home/End should be encoded as shell line movement. When no native sequence is available, cli-shell will use the conservative readline/zsh-compatible control characters: Ctrl+A for Home and Ctrl+E for End.

Option+Shift+Left/Right will compute the target word boundary from the current backend-projected line and send a backend `selectRange` from the current cursor to the target column.

Rationale:

- Home/End are editing commands in the running shell, so terminal input is the right owner path.
- Option+Shift selection must produce backend-owned overlay/copy behavior; `selectRange` already exists for this exact class of semantic selection.

Rejected alternative:

- Emit repeated Shift+Arrow escape sequences and hope the child shell/editor selects.
  - Rejected because the current product law says selected range/copy belongs to backend owners, not a host-local or child-editor guess.

### 3. Debug traces must expose both capture and routing

`--debug=selection` should show:

- renderable mouse event type/button/coordinate;
- whether a drag started backend selection;
- owner/row/col chosen by hit testing;
- whether backend start/update/end/selectRange was sent.

Rationale:

- The user is doing native manual testing. The trace file must answer whether the bug is event capture, coordinate mapping, routing, backend acceptance, or overlay publication.

## Risks / Trade-offs

- **Risk: Direct renderable drag bridge and OpenTUI global selection both fire.**  
  Mitigation: track bridge-owned drag state and ignore duplicate OpenTUI selection updates while the bridge is active.

- **Risk: Ctrl+A/Ctrl+E fallback may differ from an app running in raw mode.**  
  Mitigation: only use it as the fallback when the terminal host did not provide a native Home/End sequence; preserve native sequence when present.

- **Risk: Option+Shift selection is selection-range semantics, not child shell editor highlight.**  
  Mitigation: this matches the product law and copy behavior. Child editor-native selection can be a future backend capability if needed.

## Migration Plan

1. Add BDD tests for direct renderable drag lifecycle and shortcut routing.
2. Add renderable mouse lifecycle bridge and traces.
3. Update key encoding/routing for Home/End and Option+Shift+Left/Right.
4. Run focused cli-shell TUI tests, transport/control-plane tests if protocol behavior changes, cli-shell typecheck, and OpenSpec validation.
