## Context

The current cli-shell implementation and its surrounding change history already moved toward backend-owned terminal truth, but the design vocabulary still leaves enough room for local host composition to reappear. That ambiguity is the source of repeated regressions:

- `--web` can accidentally render a partial shell view instead of the same app surface as native cli-shell.
- native OpenTUI code can paint shell scrollbar, focus, cursor, and selection as host-local decoration after shell content is rendered.
- dialogue can look like a terminal pane while not owning the interaction state required for selection, copy, scroll, cursor, and wrapping.
- terminal-2 can be treated as a pass-through projection rather than the final app screen truth.

This design treats those failures as law violations rather than visual bugs. The durable model is:

```txt
terminal-1
  PTY-backed shell backend
  raw bytes -> termless -> shell screen truth

shell offscreen renderer
  OpenTUI cell-locked renderer
  shell cells + shell scrollbar + shell focus + shell selection + shell cursor + shell wrapping

terminal-chat
  independent OpenTUI dialogue backend instance
  message state + scrollBox offset + input cursor + selection + wrapping + copy extraction
  no native PTY scrollback

terminal-2
  composed final app screen truth
  shell offscreen frame + terminal-chat frame + bottom/status/app chrome

native host
  terminal-2 final screen -> raw stdout -> Ghostty or another real terminal program

web host
  terminal-2 final screen -> browser transport -> xterm.js/ghostty-web/Web renderer
```

The important physical boundary is that terminal-2 owns the visible app result. Native and Web are only host adapters for terminal-2.

## Goals / Non-Goals

**Goals:**

- Make `--web` visually and behaviorally equivalent to native cli-shell for the final terminal-2 app surface.
- Make `--web` the future stable automated E2E host for cli-shell, while Ghostty remains native manual acceptance.
- Keep terminal-1 as the only PTY-backed shell truth.
- Keep shell scrollbar, focus, selection, cursor, wrapping, and shell cells inside one shell offscreen renderer output.
- Give dialogue its own independent OpenTUI backend instance so selection, copy, scroll, cursor, wrapping, and input are owned by reusable backend/offscreen-renderer law instead of self-written terminal-2 algorithms.
- Let offscreen renderers hide visual chrome, especially dialogue scrollbar, without removing backend scroll or selection truth.
- Keep terminal-2 as a composed app terminal truth that can be encoded to raw output for native and Web hosts.
- Remove host-local accepted app chrome as a durable source of truth.

**Non-Goals:**

- Do not introduce a native PTY child process for terminal-2 just to make it "look like a terminal".
- Do not make terminal-chat a PTY-backed shell or rely on native terminal scrollback for dialogue.
- Do not implement terminal-chat MVP by hand-rolling dialogue selection, copy, scroll, and wrap algorithms in terminal-2 or host adapter code.
- Do not pursue a no-backend terminal-chat optimization until the independent backend route is stable and accepted.
- Do not require Web to implement a protocol-2 cell renderer if rendering terminal-2 raw output through an existing browser terminal renderer satisfies equivalence.
- Do not replace Termless backend ownership or redefine official backend package identity.
- Do not redesign cli-shell app semantics such as Avatar selection, managed mode, room identity, or app session naming except where they intersect terminal projection truth.

## Decisions

### 1. Two Protocols, One Physics Stack

The system has two lawful render paths:

```txt
Protocol 1: Raw Terminal Transport
  terminal control bytes -> a target that understands terminal control semantics

Protocol 2: Screen Projection
  backend-interpreted cells/frame/diff -> a dumb renderer or compositor
```

Protocol 2 is not an unrelated second terminal model. It is derived from backend interpretation of Protocol 1 where the source is a PTY-backed terminal. For OpenTUI dialogue surfaces, Protocol 2 may originate directly from OpenTUI UI state rather than from PTY bytes.

Rejected alternative:

- Treat raw transport as the only real contract and rebuild all app chrome by writing ANSI into another PTY.
  - Rejected because it reintroduces `cells -> ANSI -> cells` loss, especially for CJK width, cursor, selection, wrapping, and repaint stability.

### 2. Terminal-2 Is A Terminal Truth, Not Necessarily A PTY Process

Terminal-2 must have terminal identity, geometry, frames, cursor/focus metadata, viewport state, and publication. It does not need a real child PTY process because it does not run a shell command. It is the composed app output.

Native cli-shell can write terminal-2 raw output to the current process stdout. Web cli-shell can stream terminal-2 output to the browser renderer. Neither requires launching another fake PTY just to pipe bytes back into the host.

Rejected alternative:

- Start a terminal-2 PTY child process and push composed output into it.
  - Rejected because that makes an unnecessary terminal emulator loop and creates another place for wrapping, cursor, scrollback, and wide-character behavior to diverge.

### 3. Shell Offscreen Renderer Owns Shell Chrome And Interaction Projection

The shell offscreen renderer must output a complete cell-locked shell frame:

```txt
shell frame = shell cells + scrollbar + focus + selection + cursor + wrapping
```

Terminal-2 compositor may position that frame, but it must not split shell screen content from shell scrollbar/focus/selection as external decorations.

Rejected alternative:

- Compose shell text first and add scrollbar/focus/selection later at terminal-2 level.
  - Rejected because the user explicitly identified that split as a guaranteed path back to offset, selection, dirty-frame, and cursor bugs.

### 4. Terminal-Chat Is An Independent OpenTUI Dialogue Backend

Terminal-chat owns dialogue behavior through an independent OpenTUI backend instance and the same offscreen-renderer/event-bridge law used by shell surfaces. It is not a PTY-backed terminal and does not use native PTY scrollback.

Terminal-chat owns:

- message list state
- scrollBox offset
- dialogue viewport
- input cursor
- selection range
- copy extraction
- wrapping
- focus state

Terminal-chat may configure its offscreen renderer with `scrollbar: hidden`, but hiding the scrollbar only hides visual chrome. It does not remove scroll, viewport, selection, or copy truth.

The MVP must prefer backend reuse over self-written dialogue algorithms. The reason to make terminal-chat independent is not process ceremony; it is to reuse and harden the backend/offscreen-renderer path for selection, copy, scroll, cursor, wrapping, and event routing. A no-backend implementation may be considered later only if it preserves the same interface and after the backend-based implementation has passed acceptance.

Rejected alternative:

- Render dialogue as plain app text inside terminal-2 with local scroll state.
  - Rejected because dialogue selection/copy/scroll/cursor/wrap would again be split from a real interaction owner.
- Implement dialogue selection/copy/wrap through new terminal-2 algorithms without an independent backend.
  - Rejected because this increases complexity, duplicates renderer behavior, and prevents the offscreen renderer from being hardened through dialogue use.

### 5. Terminal-2 Compositor Owns Final App Screen Only

Terminal-2 compositor combines already-rendered offscreen frames and app chrome into one final app screen:

```txt
terminal-2 = layout(shell-offscreen-frame, terminal-chat-frame, bottom/status/app chrome)
```

It can perform hit-testing and route events, but it should not implement shell scrolling, dialogue scrolling, shell selection, dialogue selection, or shell cursor logic itself. Those belong to the region backend that owns the interaction.

Event flow:

```txt
host event
  -> terminal-2 region hit-test
  -> shell region: shell offscreen renderer / terminal-1 path
  -> dialogue region: terminal-chat OpenTUI backend
  -> owning backend updates state
  -> terminal-2 composes next frame
  -> native and Web render the same app result
```

Rejected alternative:

- Let terminal-2 keep independent scroll or selection state for shell/dialogue regions.
  - Rejected because terminal-2 would become a second owner for interaction truth.

### 6. Native And Web Are Equivalent Terminal-2 Hosts

Native and Web differ only in the final adapter:

```txt
native: terminal-2 frame/raw -> current stdout -> Ghostty
web:    terminal-2 frame/raw -> browser transport -> xterm.js/ghostty-web
```

`--web` is not a reduced view and not a shell-only debug surface. It exists so automated browser E2E can verify the same app screen that users see natively, because Ghostty accessibility is not reliable enough for the assistant to validate all UI behavior directly.

Rejected alternative:

- Let `--web` render only terminal-1 or a app-local Web approximation.
  - Rejected because it fails the user's original purpose for `--web` and leaves native defects untestable by automation.

### 7. Pull/Push Timing Stays Client-Paced Where Frames Are Pulled

Where terminal-2 frames are transported as screen frames or diffs, the server should send dirty signals and clients should pull at their own cadence. Pull completion should pace the next pull. The server must not keep pushing full content when clients are behind.

Raw output adapters may still stream bytes, but their source remains terminal-2 final screen truth rather than host-local recomposition.

Rejected alternative:

- Server pushes every rendered frame to every client.
  - Rejected because it makes backpressure, dropped frames, and performance debugging harder, and it previously led to stale-frame paint issues.

### 8. Transport Pacing Has Three Orthogonal Loops

Frame transport must stay split into three independent loops. This prevents scroll handling, dirty detection, and frontend paint timing from becoming one tangled timing algorithm.

```txt
input drain loop
  websocket messages -> backend queue
  consecutive viewportDelta run -> one backend scrollViewport(delta)
  click/input/resize/viewportTarget/pullFrame -> semantic boundary, flush current scroll run first

dirty clock loop
  one shared loop per terminal backend, default 30 FPS
  each WebSocket attachment owns its own dirtyOutstanding state
  compare backend getText() output plus visible viewport/cursor facts
  send frameDirty only to attachments that have consumed their previous dirty signal

pull delivery loop
  frontend sends objective input events immediately and stops there
  default frontend pacing is fixed 30 FPS
  experimental dynamic pacing is opt-in: dirty raises active cadence, unchanged drawable cells later fall back to 1 FPS
  backend returns the current backend viewport frame on pull
  frontend redraws by replaying received cells into the frame buffer once per pulled frame
```

The frontend must not merge scroll meaning and must not use input events as local redraw triggers. It sends each wheel/trackpad/scrollbar interaction as a `viewportDelta` or `viewportTarget` event, then returns. The backend owns scroll coalescing because the backend is the terminal viewport truth owner.

The backend must also keep viewport input objective. Applying `viewportDelta` or `viewportTarget` mutates backend viewport truth and stops there. It must not synchronously send `frameDirty`, reset dirty-loop state, or create a direct pull activation path from scroll input. The next visible viewport is observed by the shared dirty clock or by the client's next paced `pullFrame`.

WebSocket remains the terminal transport control-plane entry: it owns connection bootstrap, credential binding, lifecycle close, and fallback. When the client and server are in the same Bun process and same pid, the WebSocket hello/helloAck may negotiate a same-process direct data plane. That direct path is just a function-call transport for the same semantic terminal messages; it is not a second terminal truth, not a app-layer shortcut, and not tied to BroadcastChannel. The MVP uses a process-global registry claim because it is the smallest same-process primitive. Future worker/thread or cross-process transports may add MessageChannel or another broker, but they must preserve the same handshake/control-plane boundary.

The frontend output path is separate from the input path. It behaves like a small player loop: wait for the next frame time, pull backend cells, replay cells into the OpenTUI frame buffer, and commit paint. Fixed 30FPS pacing is now the default correctness path; `frameDirty` informs the next paced pull that backend-visible content may have changed, but it is not a second render command path. A pulled frame should trigger exactly one frame-buffer replay, not an application-level rerender cascade.

The OpenTUI backend-frame projection is a single interaction component, not just a canvas painter. It must keep cell replay, bounded text selection, OSC52 copy action, paste input bridge, scrollbar chrome, and keyboard/mouse event bridging together. OSC52 is the clipboard write path for copy; text paste is the host paste event routed back into backend input, not an OSC52 clipboard read. Media paste is separate: image/video/file payloads must first become MIME-aware media paste facts and then route into room asset / attachment ownership or explicit unsupported handling. Image paste must never be written into shell stdin as plain text or raw binary bytes. Concrete shortcuts such as Command+C or Ctrl+Shift+C are keybinding policy outside the projection component. App entrypoints may wire the component to a terminal backend, but they must not grow a second selection or paste algorithm beside it.

Dynamic refresh remains an experimental power-saving mode, disabled by default. In that mode, dirty may raise the client to active 30FPS, and the client may return to 1FPS only after its own pulled drawable cells have stayed unchanged for the quiet window. This optimization must not become the default pacing law until fixed 30FPS behavior is stable.

The backend should default to local row-cache frame delivery on pull. Row-cache still serializes the current viewport rows directly, but reuses per-connection row ids to avoid repeatedly transferring and parsing unchanged rows. CPU-heavy diff selection remains an explicit low-bandwidth optimization, not the default local path, because previous native testing showed row/scroll diff search could dominate interaction latency more than local bandwidth costs.

The JS runtime does not need a special "flush pending scroll before pullFrame" path. JavaScript event-loop ordering already preserves message order inside the backend turn. A queued `pullFrame` is just another semantic event in the drain loop; the drain loop flushes the current scroll run before handling the next semantic event. If this transport loop is ever ported to a multi-threaded runtime, then the implementation must reconsider that vertical synchronization boundary and explicitly flush input queued before a frame pull.

Rejected alternative:

- Let frontend coalesce scroll events because it knows the paint cadence.
  - Rejected because frontend would become a second viewport truth owner and can starve visible updates during continuous scrolling.
- Use every scroll event as an immediate frame pull trigger.
  - Rejected because scrolling then creates pull storms instead of a render-after-paint frame loop.
- Let both mirror subscription events and frame paint callbacks trigger application rerender.
  - Rejected because one backend frame can become many frontend renders of the same cells.
- Make dirty state global per terminal rather than per WebSocket attachment.
  - Rejected because one slow or unpulled consumer would hide dirty state from another consumer, or one already-dirty consumer would receive repeated duplicate dirty signals.

### 9. Row-Cache Patches Are Transport Codec Optimizations Only

Frame payload optimization belongs in the transport codec layer, not in app, viewport, or frontend rendering logic. A client still pulls frames on its own cadence and redraws the decoded cells through the same paint path. The optimization only changes how the current viewport rows are encoded between backend and client.

The MVP row-cache law is:

```txt
backend frame -> serialize each visible row into rowCode
  -> per-WebSocket encoder maps rowCode to cid
  -> send [cid, rowCode] when the row is new to that connection
  -> send [cid] when the row is already known by that connection
  -> cid 0 is the fixed empty row

frontend decoder
  -> per-connection decoder maps cid to decoded row
  -> [cid, rowCode] decodes and refreshes cache
  -> [cid] reuses cached decoded row
  -> unknown non-zero cid without rowCode is a protocol error/reset condition
```

The cache is scoped to one WebSocket attachment. It is not global terminal state, and it is not visible-frame business truth. `notModified` behavior lives in serialization/patch metadata after the transport payload has been encoded. It must not become a code-level branch such as "if the visible frame equals the last frame, skip render" inside app or viewport logic.

`notModified` consumes the server frame observation for pacing, but it does not advance the row-cache decode base frame. The next real row-cache patch must still be based on the last real row-cache frame, so the decoder can continue to resolve cid-only rows without inventing a fake frame.

Rows are the cache unit for MVP. Per-cell caching, rowCode-to-decoded-row secondary caches, and special high-frequency dictionaries may be added later, but only as codec refinements that preserve the same backend viewport ownership and client-paced pull loop.

Rejected alternative:

- Trigger active pulls or local redraws directly from scroll/viewport input to hide transport cost.
  - Rejected because scroll input must remain objective backend input. Backend dirty state and client-paced pull decide when cells are observed, and transport encoding decides how cheaply those cells move.
- Add a app-layer duplicate-frame skip before serialization.
  - Rejected because it couples visible-frame equality into business/render code and recreates the stale-frame/debug ambiguity this change is removing.

## Risks / Trade-offs

- [Raw output from a composed frame may be less efficient than direct PTY raw forwarding] -> Keep direct raw forwarding for terminal-1 where the target is shell-only; for cli-shell app hosts, correctness of terminal-2 final app equivalence wins. Add diff/frame optimization after the single truth is stable.
- [Terminal-chat as OpenTUI backend may need selection/copy support beyond current primitives] -> Treat selection/copy as terminal-chat backend obligations and write BDD tests against observable copy output, not against incidental host paint.
- [Native and Web renderers may differ in font/width behavior] -> Make terminal-2 frame truth width-based and test CJK/emoji through `--web`; Ghostty remains manual native confirmation.
- [Removing host-local chrome may require deleting working-looking code] -> Prefer breaking cleanup over preserving a second truth. Host-local chrome may remain only as a control primitive if the visible result is republished through terminal-2.
- [Terminal-2 without PTY may be misunderstood as "not a terminal"] -> Document that terminal truth is identity + geometry + frames + events + publication, not necessarily a child shell process.

## Migration Plan

1. Add the new terminal-screen-projection law specs and update existing cli-shell/terminal-view/transport/runtime specs.
2. Audit current code paths and label each as one of:
   - terminal-1 PTY shell truth
   - shell offscreen renderer
   - terminal-chat independent OpenTUI backend
   - terminal-2 compositor
   - native host adapter
   - Web host adapter
   - obsolete host-local truth
3. Delete or quarantine obsolete host-local truth paths before adding more visual fixes.
4. Implement terminal-chat as an independent OpenTUI dialogue backend with scrollBox, wrapping, cursor, selection, copy, and optional hidden scrollbar.
5. Refactor shell rendering so scrollbar/focus/selection/cursor are emitted by the shell offscreen renderer, not terminal-2 decoration code.
6. Refactor terminal-2 to publish the final app screen used by both native and Web.
7. Make native cli-shell write terminal-2 output to current stdout.
8. Make `--web` consume terminal-2 final app screen and match native layout/effects.
9. Add browser E2E coverage against `--web`, then use Ghostty manual acceptance for native parity.
10. Keep Protocol 2 frame transport on the three-loop pacing law: backend input drain, shared backend dirty clock, and client-paced pull delivery.

## Open Questions

- Which browser renderer should be the default for `--web` during the first implementation pass: xterm.js, ghostty-web, or the current terminal-view default?
- Should terminal-2 raw output be encoded as full-screen repaint first, then optimized to diff/patch, or should the initial implementation use an existing frame-diff utility immediately?
- What exact copy bridge should native use for shell/dialogue selection: OSC52, host clipboard API, or both depending on host capability?
