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
