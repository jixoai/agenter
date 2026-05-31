## 1. Architecture Audit And Cleanup Boundary

- [x] 1.1 Record a code-path map under `.chat/rebuild-cli-shell-terminal-projection-law/architecture-map.md` classifying every current cli-shell render path as terminal-1 PTY shell truth, shell offscreen renderer, terminal-chat backend, terminal-2 compositor, native host adapter, Web host adapter, or obsolete host-local truth.
- [x] 1.2 Identify every current host-local accepted app truth path, including native-only bottom chrome, dialogue chrome, shell scrollbar, shell selection, cursor owner, and Web shell-only shortcuts.
- [x] 1.3 Mark obsolete host-local truth paths for deletion or quarantine before implementing new visual behavior.
- [x] 1.4 Confirm package boundaries still keep `@agenter/cli-shell` outside core runtime internals and consuming platform APIs through client/app-extension contracts.

## 2. Terminal Screen Projection Law

- [x] 2.1 Add shared types for Protocol 1 raw output, Protocol 2 screen frame/diff, offscreen renderer output, and terminal-2 composed screen publication.
- [x] 2.2 Ensure terminal-2 can publish terminal identity, geometry, frame sequence, status, and output adapter data without requiring a child PTY process.
- [x] 2.3 Add BDD coverage proving composed terminal publication does not require a fake PTY and does not run a cells-to-ANSI-to-cells loop internally.
- [x] 2.4 Add trace/debug fields that identify frame source, dirty sequence, pull/render time, and whether output came from terminal-1, terminal-chat, terminal-2, native adapter, or Web adapter.

## 3. Shell Offscreen Renderer

- [x] 3.1 Refactor shell rendering so shell cells, scrollbar, focus, selection, cursor, and wrapping are emitted as one shell offscreen renderer frame.
- [x] 3.2 Remove terminal-2 or host-level code that adds shell scrollbar, shell focus, shell selection, or shell cursor as independent decorations after shell content rendering.
- [x] 3.3 Route shell wheel, scrollbar drag, scrollbar click, drag-select, copy, paste, keyboard, and resize events to the shell owner path and confirm the visible result returns through terminal-2.
- [x] 3.4 Add BDD tests for shell CJK/wide glyph selection, background-only highlighting, copy output, cursor position, and scrollbar truth after scroll and resize.
- [x] 3.5 Add a regression test proving shell selection cannot cross into dialogue, bottom/status chrome, or Web/native host chrome.

## 4. Terminal-Chat Independent OpenTUI Backend

- [x] 4.1 Implement terminal-chat as an independent OpenTUI dialogue backend instance using scrollBox for message viewport state rather than native PTY scrollback.
- [x] 4.2 Reuse the shared offscreen renderer/event-bridge law for terminal-chat instead of implementing dialogue selection, copy, scroll, cursor, or wrapping as terminal-2-local algorithms.
- [x] 4.3 Implement dialogue input cursor, wrapping, selection range, copy extraction, focus ownership, and scroll behavior in terminal-chat backend truth.
- [x] 4.4 Add offscreen renderer chrome configuration with at least `scrollbar: visible | hidden`, and configure terminal-chat to hide visual scrollbar by default.
- [x] 4.5 Ensure hiding dialogue scrollbar does not remove scrollBox offset, viewport, cursor, selection, wrapping, or copy truth.
- [x] 4.6 Add BDD tests for dialogue drag-select, copy, scroll, cursor, wrapping, and hidden-scrollbar behavior.
- [x] 4.7 Add a guard test proving terminal-2 does not own a replacement dialogue selection/copy/wrap algorithm while terminal-chat backend is active.

## 5. Terminal-2 Compositor

- [x] 5.1 Implement terminal-2 composition from shell offscreen frame, terminal-chat frame, and bottom/status/app chrome into one final app screen.
- [x] 5.2 Ensure terminal-2 performs hit-testing and routes events to shell or terminal-chat owners without owning a second scroll, selection, cursor, or copy truth for those regions.
- [x] 5.3 Move accepted bottom/status chrome and dialogue-open visual state into terminal-2 final screen publication so native and Web hosts can observe the same app state.
- [x] 5.4 Add BDD tests proving terminal-2 publishes the same collapsed and dialogue-open app screen to both host adapters.
- [x] 5.5 Add resize tests proving terminal-2 geometry, shell sub-geometry, and dialogue layout update without stale-frame blackouts or partial-screen disappearance.

## 6. Native Host Adapter

- [x] 6.1 Refactor native cli-shell host so it renders terminal-2 final app screen through the current process output path connected to the owning native terminal program.
- [x] 6.2 Remove any requirement to spawn a terminal-2 child PTY just to pipe app output back to Ghostty or another native terminal host.
- [x] 6.3 Keep OpenTUI/native primitives only as lawful control projections where needed, and prove their visible results are republished through terminal-2.
- [x] 6.4 Add focused automated tests for native adapter event routing and frame output without using Terminal.app, cmux, or native manual interaction as automated evidence.

## 7. Web Host Adapter And E2E Surface

- [x] 7.1 Refactor `cli-shell --web` so it renders terminal-2 final app screen, not terminal-1 shell-only output or a reduced Web approximation.
- [x] 7.2 Ensure Web host events route through the same terminal-2 hit-test and owner-event contract as native mode.
- [x] 7.3 Expose enough DOM-observable text/focus/interaction facts in `--web` for browser-driven E2E to verify shell output, dialogue content, bottom/status chrome, selection/copy, scroll, and resize behavior.
- [x] 7.4 Add browser E2E covering collapsed mode, dialogue-open mode, shell selection/copy, dialogue selection/copy, shell scroll, dialogue scroll, CJK rendering, and resize.
- [x] 7.5 Record `--web` parity evidence under `.chat/rebuild-cli-shell-terminal-projection-law/web-parity-evidence.md`.

## 8. Performance And Pull/Pacing

- [x] 8.1 Ensure frame delivery uses dirty-signal plus client-paced pull where screen frames/diffs are transported.
- [x] 8.2 Ensure clients pull after the previous render completes and respect debug FPS/pacing configuration.
- [x] 8.3 Add performance tracing for pull time, render time, dirty age, frame size, diff size, dropped/skipped frames, and queue depth.
- [x] 8.4 Add a stress test using large shell output such as `cat AGENTS.md` to verify input, scroll, and frame timing remain usable.
- [x] 8.5 Record performance evidence under `.chat/rebuild-cli-shell-terminal-projection-law/performance-evidence.md`.
- [x] 8.6 Move scroll coalescing out of the frontend and into backend transport input drain, merging only consecutive scroll runs across queued WebSocket messages.
- [x] 8.7 Implement the shared backend 30FPS dirty clock with per-WebSocket dirty state and `getText()`-based visible-frame dirty checks.
- [x] 8.8 Record the JavaScript event-loop vertical-sync boundary in code/spec comments without adding an unnecessary pre-pull flush path.
- [x] 8.9 Add regression coverage proving frontend scroll forwarding stays objective and backend drain owns scroll coalescing order.
- [x] 8.10 Separate frontend input forwarding from frontend cells drawing so scroll events do not request local refresh and each pulled frame enters one paint path.
- [x] 8.11 Add transport codec row-cache patches with per-WebSocket cid reuse, `cid=0` empty row, and no app-layer duplicate-frame skip.
- [x] 8.12 Add BDD coverage proving row-cache patches reuse known rows, decode scrolled/unchanged rows through client cache, and fall back/fail safely on unknown cid.
- [x] 8.13 Record trace/performance evidence that repeated full-frame duplicates are reduced by the transport codec path.
- [x] 8.14 Add codec-level `notModified` row-cache output so unchanged fixed/dynamic paced pulls avoid app-layer duplicate-frame work.
- [x] 8.15 Fix cli-shell pull pacing so fixed 30FPS is the default RAF-like frame loop, with dynamic 30FPS/1FPS refresh retained only as an explicit experimental mode.
- [x] 8.16 Add BDD coverage proving viewport/input events do not directly activate pull cadence and `notModified` consumes dirty without paint.

## 9. Validation And Acceptance

- [x] 9.1 Run `openspec validate rebuild-cli-shell-terminal-projection-law --strict`.
- [x] 9.2 Run package typecheck and focused BDD tests for `@agenter/cli-shell`, `@agenter/terminal-system`, `@agenter/terminal-view`, and `@agenter/terminal-transport-protocol`.
- [x] 9.3 Run `cli-shell --web` browser E2E as the automated acceptance host for the final app screen.
- [x] 9.4 Prepare a plain-language Ghostty manual checklist for the user covering native parity, shell/dialogue selection and copy, CJK, cursor, scrollbar, dialogue wrap, resize, and performance.
- [x] 9.5 Record user Ghostty manual results under `.chat/rebuild-cli-shell-terminal-projection-law/native-manual-acceptance.md`.
- [x] 9.6 Update durable `SPEC.md` files after implementation if the new terminal projection law becomes long-term platform truth.
