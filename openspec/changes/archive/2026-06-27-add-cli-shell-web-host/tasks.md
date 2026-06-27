> Superseded note:
> Treat these completed checkboxes as historical record only.
> This task list is based on the older `terminal-1` / `terminal-2` cli-shell architecture and must not be replayed directly after `realign-cli-shell-with-core-system-boundaries`.

> These checkboxes are implementation-time obligations for adding `cli-shell --web` as an official app host mode without creating a second terminal authority.

## 0. Host Boundary

- [x] 0.1 Add `--web[=PORT]` grammar to `cli-shell` as a host-mode flag rather than a terminal-backend flag.
- [x] 0.2 Keep `cli-shell` bootstrap, room binding, terminal binding, and runtime binding shared between native and Web host modes.
- [x] 0.3 Record in durable code and docs that `Bun.Terminal` or any similar PTY helper is optional harness infrastructure only and not the official app truth for `cli-shell --web`.
- [x] 0.4 Ensure launcher auto-start paths discover and reuse a healthy daemon authority for the same runtime root before bootstrapping another local daemon for `agenter shell --web`.

## 1. Web Host Surface

- [x] 1.1 Start a minimal local Web host for `cli-shell --web` and print the resolved local URL.
- [x] 1.2 Render a shell-only browser page whose first viewport contains only the terminal surface and minimal sizing/focus scaffolding.
- [x] 1.3 Mount `web-terminal-view` as the browser-facing shell projection primitive instead of introducing a second app-local terminal implementation.
- [x] 1.4 Ensure the browser host consumes the same terminal-2 visible app-terminal truth and transport discovery as native `cli-shell`.

## 2. Interaction And Authority

- [x] 2.1 Bind browser keyboard and paste input to the existing terminal input contract.
- [x] 2.2 Bind browser pointer, wheel, and visible scrollbar interaction to the shared backend viewport-mutation contract.
- [x] 2.3 Preserve explicit geometry authority: projection-only Web hosts must not silently rewrite backend rows and columns while another host owns geometry.
- [x] 2.4 If `cli-shell --web` is the sole authoritative host for its shell session, make that authority explicit and route resize through the authoritative terminal path.

## 3. Accessibility And Renderer Law

- [x] 3.1 Ensure the browser host uses a DOM-accessible terminal renderer path rather than a canvas-only shell surface.
- [x] 3.2 Add regression coverage proving the served browser shell surface remains DOM-observable enough for focus, text, and interaction acceptance.
- [x] 3.3 Keep renderer choice and `web-terminal-view` behavior aligned with existing terminal-view contracts rather than inventing host-local renderer semantics.

## 4. Shared Truth Validation

- [x] 4.1 Verify one Web host can observe visible shell input truth from terminal-2.
- [x] 4.2 Verify one native host and one Web host attached to the same terminal observe the same shared viewport truth in both directions.
- [x] 4.3 Verify multiple Web hosts attached to the same terminal observe the same visible input and shared viewport truth.
- [x] 4.4 Verify the Web host does not create a second PTY, second scrollback law, second cursor law, or second viewport law for the same attached terminal.

## 5. Acceptance

- [x] 5.1 Run `openspec validate add-cli-shell-web-host --strict`.
- [x] 5.2 Record opening architecture evidence in `.chat/add-cli-shell-web-host/opening-architecture.md`, clearly naming backend truth, projection component truth, and app-host truth.
- [x] 5.3 Record closing app effect in `.chat/add-cli-shell-web-host/closing-app-effect.md`, including the shell-only browser viewport and printed launch URL behavior.
- [x] 5.4 Capture a real browser walkthrough proving `bun agenter shell --web` serves a shell-only surface, keyboard input works, and the first viewport has no extra host chrome.
- [x] 5.5 Capture a real browser walkthrough proving pointer/wheel/scrollbar interactions mutate shared backend viewport truth rather than a browser-local mirror.
- [x] 5.6 Capture a real browser walkthrough proving DOM accessibility and focus behavior are usable on the shell surface.
- [x] 5.7 Capture one shared-host walkthrough proving native + Web or Web + Web attachments remain synchronized on visible input and viewport truth.
