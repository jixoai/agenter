> Superseded note:
> This design is built on the older `terminal-1` / `terminal-2` cli-shell ontology and must not be treated as the current architecture.
> A future cli-shell web host must be redesigned against the boundary in `realign-cli-shell-with-core-system-boundaries`.

## Context

The refined platform law is now:

1. terminal-1 remains the only shell truth: PTY, shell buffer, shell scrollback, shell cursor, shell viewport, durable shell commit source, and LoopBus shell observation source
2. terminal-2 is the authoritative final app-terminal surface seen by shell and web hosts
3. protocol 1 is the raw terminal transport substrate
4. protocol 2 is the derived shell-native composition mode that projects terminal-1 into terminal-2 inside `cli-shell`
5. `web-terminal-view` is the reusable Web projection component over the raw substrate
6. `shell-terminal-view` is the native composition role used inside cli-shell
7. `cli-shell` is the app that binds room, AvatarRuntime, terminal-1, and terminal-2

What is missing is an official browser-facing host for that same app.

The user direction is precise:

- add `agenter shell --web[=PORT]`
- avoid opening or depending on a native terminal window
- render only the terminal surface in the browser
- bind keyboard, pointer, wheel, and resize
- prefer a DOM renderer because accessibility matters

That direction is sound, but only under one hard constraint: the Web host must not become a second terminal authority.

## Goals / Non-Goals

**Goals:**

- Add a browser-facing `cli-shell --web` host mode.
- Reuse terminal-2 and the raw protocol-1 transport substrate rather than attaching the browser directly to terminal-1 shell truth.
- Reuse `web-terminal-view` as the browser-facing protocol-1 projection primitive.
- Keep the default browser page shell-only, with no extra app or debug chrome.
- Provide a DOM-accessible renderer path suitable for browser acceptance and assistive technology.
- Preserve shared viewport truth and shared visible input truth across native and Web attachments to terminal-2.

**Non-Goals:**

- Do not create a new PTY or backend terminal just because the app is hosted on the Web.
- Do not replace the existing daemon/client-sdk/app-runtime architecture.
- Do not collapse `cli-shell --web` into an ad hoc xterm.js page that bypasses `web-terminal-view`.
- Do not make the browser decode protocol 2 as the primary app path; protocol 2 remains an internal cli-shell composition path unless another host explicitly needs it.
- Do not turn this change into a broader WebUI redesign.
- Do not reopen native corrective work that belongs to `separate-cli-shell-app-from-terminal-view-components`.

## Decisions

### 1. `--web` is a app host mode, not a new backend mode

`agenter shell --web[=PORT]` will be modeled as a host-mode flag on the existing `cli-shell` app.

Rationale:

- the app identity remains `cli-shell`
- the attached room, terminal, and AvatarRuntime law does not change
- only the projection host changes from native terminal host to browser host

Rejected alternative:

- model `--web` as another terminal backend mode
  - rejected because backend identity names terminal authority, not host surface

### 2. The browser shell surface reuses `web-terminal-view`

The browser host will render terminal-2 through `web-terminal-view`, not through a second app-local terminal implementation and not through a browser-side protocol-2 decoder.

Rationale:

- `web-terminal-view` is already the durable Web projection primitive over the raw substrate
- the component contract must remain reusable outside `cli-shell --web`
- acceptance should validate the real projection primitive, not a parallel bespoke page

Rejected alternative:

- serve a one-off xterm.js page that bypasses `web-terminal-view`
  - rejected because it would create another projection stack with duplicated behavior and drift risk
- make the browser host consume protocol 2 directly
  - rejected because the refined architecture already places protocol 2 inside cli-shell composition between terminal-1 and terminal-2

### 3. The browser page is shell-only by default

The default `cli-shell --web` page will contain the terminal surface only. It may include the minimal semantic container required to size and focus the terminal surface, but it will not include extra route chrome, toolbars, drawers, diagnostics, or explanatory HTML.

Rationale:

- the app remains shell-first
- this keeps acceptance close to the intended effect
- this avoids mixing browser harness UI with app UI

### 4. DOM accessibility is a app requirement, not an optional renderer preference

The browser host must use a DOM-accessible terminal renderer path. Canvas-only hosting is insufficient for this change's primary purpose because the browser host is meant to improve accessibility and DOM-driven acceptance.

Implementation note:

- if the current `web-terminal-view` default renderer path is not sufficiently DOM-accessible, the host must select or expose the renderer path that is
- the exact renderer plumbing may still use xterm.js internals, but the app contract is "DOM-accessible shell surface"

### 5. Browser interaction remains projection-only unless authority changes explicitly

Keyboard, paste, pointer, wheel, selection, and viewport interactions from the browser host must route through the existing shared terminal contracts. Resize follows the same law as other Web hosts:

- if native cli-shell host already owns terminal-2 geometry, Web stays projection-only
- if `cli-shell --web` is the sole authoritative host of terminal-2, it may own geometry for that app-terminal session
- authority changes must remain explicit

Rationale:

- preserves one terminal truth
- matches existing runtime/component law
- keeps same-terminal multi-host behavior deterministic

### 6. `Bun.Terminal` is optional harness infrastructure only

If implementation or testing wants a local terminal subprocess harness for no-window demos or isolated repros, that harness may exist, but it is not the official app truth for `cli-shell --web`.

Rationale:

- `Bun.Terminal` or any similar PTY helper creates another terminal process boundary
- the official app host must still attach to the backend terminal truth already governed by terminal-system

Rejected alternative:

- define `cli-shell --web` itself as a `Bun.Terminal` host
  - rejected because that would create a second authority path for PTY/scrollback/cursor/viewport truth

### 7. Default launcher startup must reuse one daemon authority per runtime root

`cli-shell --web` remains a app host mode under launcher-owned daemon law. That means the default `agenter shell --web` path cannot assume "local daemon authority" is always `127.0.0.1:4580`.

When the requested local daemon endpoint is absent, the launcher must first check whether the same runtime root already publishes one healthy daemon authority. If so, the launcher reuses that authority and forwards the discovered host/port to `agenter-app-shell`. Only when no healthy same-root authority exists may the launcher bootstrap a new local daemon.

Implementation notes:

- discovery fact belongs to the launcher/daemon layer, not to `agenter-app-shell`
- the daemon should publish one runtime descriptor under the runtime home root and remove it on owned shutdown
- duplicate local startup attempts for the same runtime root should fail or fall back through launcher-owned authority discovery, not proceed until SQLite/message-system locks surface indirectly
- app env must carry the resolved daemon authority actually in use, not merely the originally requested default port

Rejected alternative:

- make `agenter-app-shell` discover or persist daemon ports itself
  - rejected because that would create a second daemon discovery authority outside the launcher contract

## Architecture

### 1. App bootstrap stays the same

`cli-shell --web` still:

- authenticates through the daemon
- resolves Avatar and session naming
- ensures room and terminal bindings
- creates or reuses terminal-1 as shell truth
- creates or reuses terminal-2 as final app-terminal truth

The difference begins only after attach succeeds.

### 2. Host-mode split

After attach:

- native mode keeps terminal-1 -> protocol-2 -> terminal-2 composition inside cli-shell and renders terminal-2 back to the owning shell host
- Web mode starts a minimal local HTTP server and serves a browser page that mounts `web-terminal-view` against terminal-2

Both hosts consume:

- the same terminal-2 identity
- the same protocol-1 transport discovery for terminal-2
- the same runtime/session identity truth

### 3. Browser host composition

The browser host contains:

- one full-viewport shell page
- one `web-terminal-view` bound to terminal-2
- host-local focus/bootstrap glue only

It does not contain:

- route-level debug chrome
- terminal catalogs
- extra split panes
- host-owned shadow transcript state

### 4. Interaction flow

- keyboard input -> terminal-2 protocol-1 input bytes
- paste -> terminal-2 protocol-1 input bytes
- wheel / scrollbar / pointer scroll -> terminal-2 shared viewport mutation contract
- resize -> terminal-2 geometry update only when this host is the explicit geometry authority

### 5. Acceptance model

This host exists partly to make real app acceptance easier and stronger:

- browser automation can drive real DOM focus and keyboard paths
- browser tests can inspect accessible text and DOM state
- shared-viewport truth can be verified between Web and native hosts against terminal-2 without native GUI automation

## Risks / Trade-offs

- `[web-terminal-view current renderer path is not accessible enough]`
  - Mitigation: make DOM accessibility part of the change contract and choose renderer plumbing accordingly.

- `[host-mode split leaks app logic into host-specific wrappers]`
  - Mitigation: keep terminal-1/terminal-2 composition inside cli-shell, and isolate browser-host startup to the host boundary only.

- `[browser host starts to accrete debug chrome]`
  - Mitigation: make shell-only first viewport an explicit requirement and acceptance gate.

- `[developers misuse Bun.Terminal as app truth]`
  - Mitigation: write the non-goal and optional-harness boundary explicitly into specs and tasks.

## Migration Plan

1. Add the `--web[=PORT]` app contract and Web-host requirements to OpenSpec.
2. Make terminal-1 / terminal-2 explicit in cli-shell bootstrap and runtime contracts.
3. Implement a host-mode split in `cli-shell` startup around terminal-2 without changing app bootstrap truth.
4. Serve a minimal browser host that mounts `web-terminal-view` against terminal-2.
5. Bind browser input, wheel, and resize to terminal-2 shared contracts.
6. Add launcher-owned daemon authority discovery/reuse so default `agenter shell --web` startup is stable on one runtime root.
7. Add browser acceptance coverage for shell-only surface, DOM accessibility, and shared viewport/input truth.

## Open Questions

- Whether the minimal browser host should live inside `packages/cli-shell` or delegate to a tiny reusable Web host helper package is an implementation choice, not a spec blocker.
