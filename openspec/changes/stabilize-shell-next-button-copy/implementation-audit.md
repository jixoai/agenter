## Reference Audit

- `git diff -- extensions/cli-shell` is empty. Legacy cli-shell stayed read-only.
- Legacy paths used as reference only:
  - `extensions/cli-shell/legacy/terminal2/src/tui/backend-terminal-frame.ts`
  - `extensions/cli-shell/legacy/terminal2/src/tui/core-app.ts`
  - `extensions/cli-shell/legacy/terminal2/src/tui/live-terminal-mirror.ts`
- The copied behavior is the backend-owned terminal law: pane-local selection events go to the terminal source, copy requests ask backend selected text, async selection text is delivered through OSC52, and paste is owned by the focused terminal frame.
- OpenTUI gives low-level renderables/events but no shell-next product Button. Shell-next now owns a Button primitive for bracket labels, hit regions, hover, active, disabled, and event resolution.

## BDD Feedback Loop

- New BDD first exposed paste delivery drift: one bracketed paste wrote the backend once but followed cursor twice.
- Fix: `ShellNextFrameBufferTerminalPane` no longer calls `followCursor` inside the `sendInputText` bridge; the terminal frame owns the single follow-cursor call after successful paste.
- New BDD also exposed renderer primary drift: middle-click cleared the visible renderer selection.
- Fix: renderer-pane middle-click is consumed only to preserve OpenTUI selection state; shell-next does not implement local middle-click paste.

## Self Review Round 1

- Active button state now uses underline through the shared Button primitive and is covered for Chat title actions and statusbar actions.
- Terminal resize still uses debounce plus a conflated pending-size slot; rapid resize delivers only the newest backend size.
- ShellPane paste now has one owner and one follow-cursor call. ShellPane copy still follows backend selected text and async OSC52 delivery.
- Chat/renderer primary copy mirrors completed selection to primary and keeps visible selection after middle-click.
- ShellPane, ChatPane, statusbar, and CloseConfirmDialog no longer have per-surface hover color changes; hover is bold-only.
- CloseConfirmDialog content buttons and border `[x]` use the same Button styling path.

## Self Review Round 2

- `extensions/cli-shell` was not modified or imported. Shell-next copied the needed behavior into its own modules.
- The old pane chrome helper is no longer the only button law; `renderable-mux/button.ts` is the shared primitive.
- Tests cover Button behavior, ShellPane selection/copy/paste, renderer primary selection, statusbar active/hover, top-layer hover, and resize conflation.
- The remaining completion gate is workspace hygiene: unrelated pre-existing dirty files still need explicit resolution before final status can be clean.

## Drift List

- I previously treated local titlebar/statusbar helpers as "the Button solution". That was too weak; they did not prevent each surface from inventing its own hover behavior.
- The earlier statusbar test checked bold but missed the yellow hover color, so it allowed a visible product bug to survive.
- The paste path had two ownership points: the terminal frame and the ShellPane global paste listener/bridge behavior. The correct law is one focused terminal frame owner.
- Renderer primary copy was modeled as "emit OSC52 only", but the real behavior also had to protect OpenTUI's visible selection from middle-click clearing.
- The previous change was over-claimed as complete before manual acceptance caught these interaction gaps.

## Future Tasks

- Run manual TTY acceptance for ShellPane drag selection, OSC52 clipboard, and primary clipboard across the terminal emulators the team actually uses.
- After shell-next is accepted, extract the mux/layout/Button/terminal-frame laws into the future `opencompose` package boundary.
- Keep `cli-shell` read-only until it is deleted; do not add compatibility hooks back into the legacy product.

## Rework Trigger 2026-05-28

Manual acceptance found the previous pass was still incomplete:

- ChatPane middle-click no longer clears selection, but primary clipboard is not working.
- ShellPane copy/paste works, but primary clipboard is not working.
- ShellPane is missing legacy Option/Shift arrow behavior for word movement and keyboard selection.
- ChatPaneTitlebar buttons still do not behave like the shared Button.
- Button active underline is still not visible.
- Shell resize still feels blocked; debounce plus conflated behavior must be proven at the terminal source/backend boundary.
- Resize handle click micro-adjustment only moves one way instead of following the clicked glyph.

Decision: reopen this change as rework, write BDD for the missing behavior first, and keep all implementation inside `extensions/shell-next` unless evidence proves a lower package needs a separate discussed change.

## Rework BDD Evidence

- Chat titlebar hover and active underline are now asserted on visible titlebar cells, not only on helper output.
- ShellPane drag selection now asserts a `primary` copy request on selection end for both sync selected text and async live selected text.
- Renderer/Chat selection completion now asserts `copyToClipboardOSC52(..., primary)` and preserves the visible selection through middle-click.
- ShellPane keyboard affordances now have BDD for Option+Left/Right word movement, Shift+Left/Right cell selection, and Shift+Option+Left/Right word selection.
- Terminal source resize scheduling now has a blocked-backend test proving obsolete sizes do not form a backlog and only the newest pending size is delivered.
- Resize handle click micro-adjustment now has a glyph-directional test proving `◀` moves by `-1` and `▶` moves by `+1`.

## Rework Self Review Round 3

- ChatPane middle-click no longer clears selection, and shell-next now emits the primary OSC52 target when renderer selection finishes. The remaining risk is whether the user's terminal emulator honors OSC52 primary; shell-next cannot force middle-click paste support if the emulator ignores that target.
- ShellPane copy/paste still works, and selection end now requests primary copy from the backend path. The same terminal-emulator primary support risk remains.
- Legacy terminal keyboard behavior is copied into shell-next-owned `terminal-interaction-controller`: Option arrows move by word, Shift arrows select by cell, and Shift+Option arrows select by word.
- ChatPane titlebar actions use the pane chrome Button path in the direct OpenTUI surface and are BDD-covered for bold hover and underline active state.
- Button active state is underlined in the shared primitive and tested on visible titlebar/statusbar cells.
- Shell resize scheduling moved from pane view throttling into terminal source implementations through `ConflatedResizeDispatcher`, so a blocked backend resize cannot accumulate old sizes.
- Resize handle click direction is now based on the clicked glyph cell instead of always applying `+1`.

## Rework Self Review Round 4

- `extensions/cli-shell` remains read-only. The legacy behavior was used as a reference, but the new controller/source code lives under `extensions/shell-next`.
- The Button law is still centralized in shell-next's primitive. Product surfaces should continue migrating any future ad-hoc bracketed actions to that primitive instead of hand-rendering labels.
- Clipboard target handling does not import `@opentui/core` private subpaths. OpenTUI's internal target enum is not publicly exported in the current dependency, so shell-next uses local typed constants based on the public `copyToClipboardOSC52` signature.
- Resize debounce plus conflation now belongs to the source/backend boundary. The pane view only routes geometry changes to the source.
- Primary clipboard and rapid resize still require manual TTY acceptance because terminal emulator OSC52 primary support and real ghostty-native resize pressure are environment-dependent.

## Rework Drift List

- I previously treated "selection does not clear" as enough for primary clipboard. That was incomplete; shell-next also had to prove it sends the primary OSC52 target.
- I previously left word navigation out of the migration scope. That was wrong because the old cli-shell behavior was part of the terminal interaction contract users already felt.
- I previously accepted Button helper tests as enough. They were not enough; visible titlebar/statusbar cells had to be tested because the bug was in rendered behavior.
- I previously kept resize scheduling partly at the pane layer. That was the wrong ownership boundary for a blocked terminal backend.
- I previously made resize click micro-adjustment a generic click. It needed to be glyph-directional.

## Rework Future Tasks

- Run manual TTY acceptance for OSC52 primary selection in the terminal emulators the team supports. If a terminal ignores OSC52 primary, document it as an environment limitation rather than a shell-next mapping bug.
- Run manual rapid-drag resize against the real ghostty-native backend. If frame drops remain after source-level conflation, investigate whether ghostty-native needs a lower-level resize scheduler.
- Keep future Chat/Room/Help/Statusbar actions on the shared Button primitive; do not add new bracketed labels by hand.
- After shell-next is accepted, extract the mux/layout/Button/terminal-frame laws into the future `opencompose` package boundary.

## Rework Verification

- `openspec validate stabilize-shell-next-button-copy --strict`: pass.
- `bun test extensions/shell-next/test/shell-next-app.test.ts extensions/shell-next/test/pane-source.test.ts extensions/shell-next/test/conflated-resize-dispatcher.test.ts`: 50 pass, 0 fail.
- `bun run --filter 'agenter-ext-shell-next' test`: 110 pass, 0 fail.
- `bun run --filter 'agenter-ext-shell-next' typecheck`: pass.
- `git diff --check`: pass.

## Second Rework Trigger 2026-05-28

Manual acceptance after `f4b7a687` found that only two behaviors were actually fixed:

- resize click micro-adjustment follows the clicked `◀/▶` glyph;
- Option+arrow can move the ShellPane cursor by word.

The remaining failures are now treated as architecture-boundary failures:

- terminal input, selection, scroll, copy, paste, and follow-cursor behavior were spread into ShellNextApp and mocked tests instead of living in a shell-next internal Terminal Engine;
- Room-backed Chat used string-only host chrome instead of the shared pane chrome Button overlay;
- primary clipboard must remain a single host clipboard/OSC52 capability path, not an app-owned primary register or dual fallback path;
- OpenCompose stays terminal-agnostic and continues to provide only pane composition primitives.

Decision: reopen the change for a second rework. Keep `extensions/cli-shell` read-only, copy the relevant `legacy/terminal2` laws into shell-next-owned terminal-engine modules, and make BDD target the real product paths that failed manual acceptance.

## Second Rework Completion

- Shell-next now has an internal `terminal-engine` boundary under `extensions/shell-next/src/terminal-engine`.
- Normal terminal input, bracketed paste, Option word motion, Shift cell selection, and Shift+Option word selection now all route through one input transaction law: clear backend selection unless explicitly preserving, write once, and follow cursor only after accepted input.
- `TerminalProtocolPaneSource.writeInput(...)` now returns an accepted/rejected boolean, so shell-next no longer lies about whether backend input was accepted.
- Room-backed Chat host chrome now uses `ShellNextPaneChromeController`, so hover and active rendering match direct Chat panes instead of relying on string-only border titles.
- Terminal drag selection primary copy no longer fires twice; backend-owned drag end now suppresses the duplicate OpenTUI selection-finished path.

## Self Review Round 5

- The architecture boundary is now correct: OpenCompose remains terminal-agnostic, while terminal input/selection/paste/follow-cursor behavior moved into shell-next-owned modules.
- Manual feedback about normal input clearing selection and rejected input not following the cursor is now covered by focused BDD and implemented in the transaction layer.
- Manual feedback about Shift/Option selection preservation is now handled by explicit `preserveSelectionAnchor` routing instead of app-level ad-hoc state changes.
- Manual feedback about Room-backed Chat titlebar behavior is now closed; attached Room uses the same hover/underline overlay law as direct Chat panes.
- Manual feedback about primary clipboard staying KISS is now closed at the product layer: shell-next uses one host clipboard/OSC52 primary capability path and does not maintain a local primary register.
- The remaining residual risk is environment-only: a terminal emulator may ignore OSC52 primary even though shell-next emits the correct request.

## Second Rework Verification

- `bun test extensions/shell-next/test/shell-next-app.test.ts`: 48 pass, 0 fail.
- `bun run --filter 'agenter-ext-shell-next' test`: 115 pass, 0 fail.
- `bun run --filter 'agenter-ext-shell-next' typecheck`: pass.
- `openspec validate stabilize-shell-next-button-copy --strict`: pass.
- `git diff --check`: pass.
- `git diff -- extensions/cli-shell`: empty.

## Third Rework Trigger 2026-05-29

The user clarified the remaining product law in plain terms and required that this wording remain the anchor for the next implementation round:

1. `Shell的selection仍然有问题，你不能在Shell这一层做selection，得到内核层去做，你因为你在Shell这里考虑不到滚动的问题`
2. `Shell移动关闭可以自动滚动到合适的位置了`
3. `Help Chat 这里没有应用“激活状态”。ChatPaneTitlebar这里是有激活态的`
4. `Button的激活状态不应该修饰[ ]border本身，只修饰border内部`
5. `首先你应该理解了实时同步，并只吃合并后的最新尺寸。这个可能导致的结果是仍然是1s做一次resize(每次要做1s），但是只要停下resize，最多再做一次就行。这是底层自己的合并策略。`
6. `其次再次基础上，仍然要做debounce(200ms)，目的是减少没必要的事件发送。这是上层自己的节流策略`

Interpretation for this rework:

- bullet 2 is already accepted and should stay working;
- bullets 1, 3, 4, 5, and 6 become the active scope;
- the resize law now explicitly has two independent layers with different ownership.

## Third Rework Bound

- This round is reopened from an `all_done` change state because repo truth no longer matches the user's accepted truth.
- BDD stays mandatory.
- Self-review is explicitly bounded to at most five rounds.
- Final reporting must merge the rounds into:
  - one drift list;
  - one encountered-problems list.

## Third Rework Progress

- The upper resize layer is now explicit in `extensions/shell-next/src/terminal-projection/resize-send-scheduler.ts` with a product-default `200ms` debounce.
- The lower resize layer remains explicit in source implementations through `ConflatedResizeDispatcher`, so blocked backend resize only retains the newest pending size.
- Shared button rendering now decorates only inner content. `[` and `]` stay plain while hover uses bold and active uses underline on the inner text cells only.
- Shell terminal drag selection no longer keeps durable truth in `OpenComposeFrameRenderable`. The generic frame is now `selectable = false`, and shell-next owns terminal drag-selection state through `terminal-engine/drag-selection-controller.ts`, attached in `OpenComposeTerminalViewRenderable`.
- The new BDD check for this law is `Scenario: Given a shell pane terminal frame When rendered Then ShellPane selection does not rely on OpenTUI selectable state`.

## Third Rework Self Review Round 1

- The five 2026-05-29 bullets are now aligned at code level except for final full-suite verification and final reporting artifacts.
- Shell selection ownership is no longer kept in the Shell/OpenTUI generic frame. Scroll semantics can continue to belong to backend/source layers because the generic frame only projects coordinates and paints overlays.
- Help/Chat active state is already covered by visible-cell BDD on the mixed statusbar path and still stays active after this rework.
- Button active state now decorates only inner content, and the bracket borders stay plain in the visible renderer assertions.
- Dual-layer resize is now explicit rather than implied: top-layer pane debounce plus bottom-layer backend conflation.

## Third Rework Self Review Round 2

- The resize wording now matches the user's plain-language law:
  - top layer reduces unnecessary sends with `200ms` debounce;
  - bottom layer processes only the latest surviving size while a slow backend resize is still in flight.
- The two responsibilities are now split across different modules and do not collapse into one timer:
  - `resize-send-scheduler.ts`
  - `conflated-resize-dispatcher.ts`

## Third Rework Self Review Round 3

- Shell selection no longer depends on OpenTUI's own selection lifecycle. That removes the previous false ownership where the Shell view had to infer drag finish and clear semantics from a UI-level selection object.
- OpenCompose remains terminal-agnostic: the generic frame still owns coordinate projection, semantic double/triple click, and overlay painting, but not terminal drag state.

## Third Rework Self Review Round 4

- Shared Button behavior remains consistent across statusbar, pane titlebars, and dialogs because the rendering law stays centralized in `renderable-mux/button.ts`.
- The most important regression caught during this round was not implementation but test timing: the 200ms pane-level debounce test only waited 130ms after the final resize schedule, so it failed for the wrong reason.

## Third Rework Self Review Round 5

### Drift List

- I previously treated passing behavior tests as enough proof that selection ownership was correct. That was wrong because the generic frame was still carrying terminal drag state even while product behavior looked mostly right.
- I previously over-trusted the first 200ms debounce test failure as an implementation bug. It was a bad test window.
- I previously left terminal-view selection callback types piggybacking on the generic frame options. That blurred the boundary after selection ownership moved out of the generic frame.
- I previously reported the third rework as "mostly about resize and button law", but the real unresolved core was still selection ownership.

### Encountered Problems List

- The hardest issue was false ownership: OpenTUI selection lifecycle and shell-next terminal drag lifecycle were partially overlapping, which made the Shell layer look correct while still owning the wrong truth.
- The second recurring issue was timing ambiguity. Debounce tests are easy to write incorrectly if the assertion window is measured from the first event instead of the last event.
- The third issue was type coupling after boundary cleanup. Once selection callbacks were removed from `OpenComposeFrameRenderableOptions`, terminal-view and terminal-frame needed their own explicit callback types.
- Manual acceptance and test acceptance were not aligned earlier. The fix in this round was to add one direct BDD assertion that `terminalView.selectable === false` so the boundary itself is checked, not only downstream effects.

## Third Rework Verification

- `openspec validate stabilize-shell-next-button-copy --strict`: pass.
- `bun test extensions/shell-next/test/resize-send-scheduler.test.ts extensions/shell-next/test/conflated-resize-dispatcher.test.ts extensions/shell-next/test/statusbar.test.ts extensions/shell-next/test/shell-next-app.test.ts`: 63 pass, 0 fail.
- `bun run --filter 'agenter-ext-shell-next' test`: 121 pass, 0 fail.
- `bun run --filter 'agenter-ext-shell-next' typecheck`: pass.
- `git diff --check`: pass.
- `git diff -- extensions/cli-shell`: empty.
