## Context

`shell-next` has the right architectural direction: an embedded OpenTUI mux with protocol-backed terminal panes and renderer panes. The current failures are caused by two places where that architecture is still leaky.

First, OpenTUI gives us renderables and events, but it does not give us a Button component. The current code therefore builds "buttons" separately in pane chrome, Chat chrome, statusbar, and top-layer dialogs. Those local renderers disagree about hover colors, active underline, hit boxes, and titlebar overlays.

Second, the ShellPane terminal projection partially copied the legacy cli-shell selection/paste model but did not preserve the whole event law. The legacy code treats terminal selection, copy, paste, and clear-selection as backend-owned facts. Shell-next must copy that behavior into its own modules instead of importing or editing `extensions/cli-shell`.

## Goals / Non-Goals

**Goals:**

- Add a reusable shell-next Button primitive that owns bracketed labels, hover state, active underline, disabled state, hit-region geometry, and event consumption.
- Replace all shell-next titlebar/statusbar/dialog button rendering with that primitive or a thin adapter over it.
- Make hover styling bold-only and active styling underline-only across ShellPane, ChatPane, statusbar, and CloseConfirmDialog.
- Restore ShellPane selection/copy/paste by copying the needed legacy behavior into `extensions/shell-next`.
- Ensure paste is delivered exactly once to the focused terminal backend.
- Ensure renderer/Chat primary copy does not clear the user-visible selection during middle-click validation.
- Ensure terminal backend resize delivery is both debounced and conflated.
- Add BDD scenarios for every manual failure and make the self-review artifacts compare implementation against the user's original wording.
- Leave the workspace clean after final commit.

**Non-Goals:**

- Modify `extensions/cli-shell` source, tests, or OpenSpec artifacts.
- Import cli-shell implementation into shell-next.
- Add an OpenTUI upstream dependency or patch OpenTUI itself.
- Archive this change before manual acceptance.

## Decisions

1. Button becomes a platform primitive, not another helper string builder

   Shell-next will add a small `ShellNextButton` primitive under `renderable-mux`. It will expose pure builders for tests and renderable adapters for OpenTUI surfaces. The primitive owns one visual law:

   - label is stable and bracketed;
   - hover adds bold only;
   - active adds underline only;
   - no hover color shift;
   - clickable coordinates match visible cells.

   Alternative considered: keep `shellNextPaneActionAttributes` and fix each surface. That keeps four local "button" implementations alive and repeats the failure mode.

2. Statusbar and titlebars consume the same Button state model

   Pane titlebars need absolute overlay renderables because OpenTUI border titles do not provide independent per-button styling. Statusbar can use styled text chunks. Both should consume the same Button state and tests must inspect rendered spans rather than trusting helper output alone.

   Alternative considered: force all buttons through a single `TextRenderable`. This does not fit border title overlays and would reintroduce coordinate drift.

3. ShellPane copy/paste follows legacy backend ownership

   The legacy cli-shell path uses backend-owned selection truth. Shell-next should copy that model:

   - mouse drag routes pane-local owner coordinates to the terminal source;
   - copy shortcuts call backend copy selection first;
   - selected text returned asynchronously is written to OSC52 once;
   - paste events are handled by the focused terminal frame once and then consumed.

   Alternative considered: use OpenTUI renderer selection for terminal panes. That is wrong because terminal text selection is owned by termless/ghostty-native state, not by OpenTUI renderer text.

4. Primary selection mirroring is best-effort and must not clear visual selection

   Renderer pane primary copy should happen on selection completion and should not intercept middle-click paste. Shell-next must avoid local middle-click handlers and avoid using primary-copy calls that reset renderer selection state.

   Alternative considered: manually emulate middle-click paste. That belongs to the terminal/OS, not shell-next.

5. Resize delivery needs an explicit conflated queue

   Debounce alone is not enough. The terminal projection will maintain a single pending size slot. Each rapid layout update replaces the slot; the timer delivers only the newest size. Stable changes still deliver after the debounce window.

   Alternative considered: debounce mux layout. That makes cheap renderer panes lag and mixes product layout with terminal backend pressure.

## Risks / Trade-offs

- [Risk] OpenTUI span attributes may not render underline in some terminal backends. → Mitigation: tests assert both attribute state and captured visual behavior where the test renderer exposes spans; if the terminal backend cannot display underline, the primitive still keeps the state law centralized for a targeted renderer workaround.
- [Risk] Primary clipboard behavior depends on terminal emulator support. → Mitigation: shell-next only emits the correct OSC52 primary request and does not own middle-click paste.
- [Risk] Paste duplication may come from both app-level and frame-level listeners. → Mitigation: BDD must assert one paste event produces one backend input write and the implementation must keep one owner for terminal paste.
- [Risk] Existing unrelated dirty files can prevent a clean final workspace. → Mitigation: inspect them separately; either commit, revert, or preserve them explicitly before final status, with no silent mixing into shell-next commits.

## Rework Design Notes

Manual acceptance exposed that several tests were too high-level or looked at helper output instead of the product node that receives real events. The rework changes the test law:

1. Button tests must prove a titlebar action created by `ShellNextPaneChromeController` uses the same primitive state as statusbar/dialog buttons. Checking `buildShellNextButtonChunk(...)` alone is insufficient.
2. Active underline must be asserted on the visible titlebar/statusbar cells after the surface renders, not only on the pure chunk builder.
3. Clipboard tests must prove shell-next sends the correct OSC52 target. OpenTUI's `ClipboardTarget` enum exists in package internals but is not exported by the public package entry in the current dependency version, so shell-next uses a typed local constant derived from `CliRenderer.copyToClipboardOSC52` instead of importing a private subpath. The effective mapping is `Clipboard=0`, `Primary=1`; if the terminal emulator ignores OSC52 primary, that is a manual-environment boundary, not a shell-next target mapping bug.
4. Terminal word navigation is not a key encoder concern alone. It needs a small terminal interaction controller that reads the current frame line/cursor, calculates word boundaries, optionally selects a backend range, and then sends the repeated arrow bytes to the source.
5. Resize pressure belongs at the source/backend boundary. The pane view can still avoid redundant size calls, but each terminal source implementation must own a debounce plus conflated dispatcher so a blocked resize cannot accumulate a backlog of obsolete sizes.
6. Resize handle clicks are glyph-sensitive. For horizontal handles, `◀` applies `-1` and `▶` applies `+1`; for vertical handles, `▲` applies `-1` and `▼` applies `+1`.

The implementation should stay within `extensions/shell-next` unless evidence shows `ghostty-native` or OpenTUI itself is the only correct fix. If a lower package needs changes, pause and discuss before editing it.

## Second Rework Design Notes

Manual acceptance after the first rework proved that the remaining failures are not isolated bugs. The implementation put terminal interaction behavior in the wrong layer and the BDD asserted mocked application calls instead of the real product paths.

### Boundary Decision

OpenCompose SHALL remain a generic pane composition layer. It owns layout, split/resize, pane chrome, shared Button rendering, focus/event dispatch, and two pane content shapes:

- custom-rendered panes;
- OpenTUI `CliRenderer` panes.

OpenCompose SHALL NOT gain a Terminal Kernel in this change. Terminal input, terminal selection, terminal viewport scrolling, copy/paste, and follow-cursor semantics are shell-next terminal-engine responsibilities for now.

### Shell-next Terminal Engine

Shell-next will add an internal terminal-engine boundary that consumes OpenCompose custom-rendered panes and adapts terminal sources. This boundary owns the interaction laws copied from `legacy/terminal2`:

- normal terminal input is a transaction: clear backend selection, write bytes, and follow cursor only after the backend accepts the input;
- selection-preserving movement, such as Shift+Option word selection, must opt out of selection clearing explicitly;
- mouse drag selection routes visible cells to backend owner coordinates and receives selection overlays from the backend for painting;
- wheel and scrollbar events route to backend viewport operations;
- paste is handled by the terminal frame and follows the cursor exactly once after accepted input;
- copy routes through backend-selected text and a single OSC52 target request.

ShellNextApp should only own product composition: prefix keybindings, pane toggles, Help/Chat/Statusbar, close confirmation, and Room binding.

### Clipboard Decision

Primary clipboard remains a single-path capability. Shell-next will request `primary` through the host clipboard/OSC52 path and report failure if the environment does not support it. Shell-next will not maintain a second local primary-selection register and will not emulate middle-click paste.

### BDD Correction

The next tests must target the shell-next terminal engine and real product surfaces:

1. terminal input after a scrolled viewport calls `followCursor`;
2. normal terminal input clears backend selection before writing bytes;
3. Shift/Option selection preserves the keyboard selection anchor and does not clear backend selection;
4. Room-backed Chat titlebar actions use the same pane chrome Button overlay behavior as direct Chat panes;
5. primary copy requests are asserted as a capability request, while unsupported primary clipboard remains an explicit environment result rather than a product fallback.

## Third Rework Design Notes

Manual acceptance on 2026-05-29 clarified the exact remaining law corrections.

### Original Intent To Preserve Verbatim

This rework is anchored to the user's latest concrete intent:

1. `Shell的selection仍然有问题，你不能在Shell这一层做selection，得到内核层去做，你因为你在Shell这里考虑不到滚动的问题`
2. `Help Chat 这里没有应用“激活状态”。ChatPaneTitlebar这里是有激活态的`
3. `Button的激活状态不应该修饰[ ]border本身，只修饰border内部`
4. `首先你应该理解了实时同步，并只吃合并后的最新尺寸。这个可能导致的结果是仍然是1s做一次resize(每次要做1s），但是只要停下resize，最多再做一次就行。这是底层自己的合并策略。`
5. `其次再次基础上，仍然要做debounce(200ms)，目的是减少没必要的事件发送。这是上层自己的节流策略`

The implementation and self-review must compare against these sentences directly instead of collapsing them into generic summaries.

### Selection Ownership Correction

The current shell-next terminal frame already routes selection events to backend sources, but it still keeps selection gesture state in `OpenComposeFrameRenderable` (`pendingDragAnchor`, drag lifecycle, OpenTUI selection suppression). That is still too high in the stack for ShellPane selection truth because:

- scroll ownership belongs to the terminal backend / mirror;
- viewport-relative coordinates are only a projection, not the durable terminal selection truth;
- drag-to-select across scrollback, follow-cursor, and future auto-scroll behavior cannot be solved correctly if the frame layer owns the selection gesture state machine.

The third rework therefore tightens the law:

- the Shell/OpenTUI frame layer may translate raw mouse events into terminal-intent commands only;
- durable selection gesture state, scroll-aware anchor/focus evolution, and selection lifecycle truth belong to the shell-next terminal kernel boundary (`extensions/shell-next` internal terminal engine / source / mirror path), not to the pane view layer.

This does **not** promote terminal behavior into OpenCompose. It only removes remaining terminal-state ownership from the OpenCompose-backed Shell view layer.

### Dual-Layer Resize Law

The previous resize implementation already had a conflated dispatcher at terminal source boundaries, but manual acceptance showed that this alone does not satisfy the user's intended contract.

The exact law is now:

1. **Bottom-layer latest-only conflation**
   - lives at the terminal backend boundary;
   - while one expensive backend resize is in flight, only the newest pending size is retained;
   - when the in-flight resize finishes, at most one newest resize is sent next.

2. **Top-layer `200ms` debounce**
   - lives above the backend queue as the product-facing resize send policy;
   - suppresses unnecessary intermediate resize sends during rapid drag;
   - does not replace the bottom-layer conflation law.

In plain terms: upper layer reduces noise, lower layer prevents backlog.

### Button Active Decoration Law

The shared Button primitive already centralizes hover/active attributes, but it still decorates the whole bracket token. The corrected law is:

- border brackets remain plain;
- only the inner label/glyph content receives active underline and hover bold;
- this law must be shared by statusbar actions, pane title actions, and dialog actions.

### Iteration And Review Bound

This rework is intentionally bounded:

- at most five explicit implementation/self-review rounds;
- each round must leave a factual note in the change audit;
- the final output must merge the rounds into:
  - one drift list;
  - one encountered-problems list.

## Fourth Rework Design Notes

Manual acceptance on 2026-05-29 after the third rework accepted resize, but it found two remaining law failures plus one visible statusbar symptom:

1. `help/chat这组按钮仍然没有“激活态”的样式（下划线）`
2. `我发现所有的Button的click事件绑定不对，click需要是mousedown+mouseup，而不是现在只判断了mousedown`
3. `Shell的Selection问题仍然没有解决`
4. `Shell的双击应该要能选中文本，三击要能选中行。目前看到的效果是选中但是马上被取消选中了`

### Shared Button Click Commitment

Shell-next Buttons already share rendering law, but they still do not share the correct click commitment law. The corrected law is:

- hover state may react during mouse move;
- a button becomes armed on `mousedown`;
- the button action commits only on `mouseup` if the same visible button region is still under the pointer;
- `mousedown` alone does not fire the action;
- releasing on a different cell cancels the action.

This law belongs to shell-next's shared Button interaction path and must be reused by:

- statusbar `Help` / `Chat`;
- pane title actions;
- dialog/titlebar close buttons;
- top-layer content buttons.

### Semantic Selection Must Not Be Re-cleared By The Shell View

The semantic double/triple click path is already a backend-intent path:

- double click asks the backend/kernel for word selection;
- triple click asks the backend/kernel for line selection.

The current bug happens because the Shell view still arms its drag-selection lifecycle even after semantic selection already consumed the click and the backend selection overlay became visible. That causes an immediate clear-selection on release.

The corrected law is:

- if semantic selection consumed the mouse-down event, the Shell-view drag-selection controller must not arm for that click cluster;
- backend/kernel-owned semantic selection overlay truth remains visible through mouse-up;
- the Shell/OpenTUI terminal view stays an input adapter and overlay projector, not the owner that clears semantic selections after the backend already accepted them.

### Verification Focus

This rework must add focused BDD for:

- mouse click commitment on the shared Button path;
- statusbar `Help` / `Chat` active underline after mouse toggles;
- semantic double-click word selection staying visible;
- semantic triple-click line selection staying visible.
