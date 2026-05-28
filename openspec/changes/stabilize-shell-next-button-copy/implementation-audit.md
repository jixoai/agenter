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
