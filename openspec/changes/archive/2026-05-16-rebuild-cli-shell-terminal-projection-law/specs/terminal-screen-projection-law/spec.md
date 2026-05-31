## ADDED Requirements

### Requirement: Terminal projection SHALL distinguish raw transport from backend screen projection

The system SHALL distinguish Protocol 1 raw terminal transport from Protocol 2 backend screen projection. Protocol 1 carries terminal control bytes to a target that understands terminal control semantics. Protocol 2 carries backend-authored screen cells, frames, or diffs to a renderer or compositor that does not own terminal interpretation.

#### Scenario: Raw-capable target consumes protocol 1
- **WHEN** a target can interpret terminal control bytes directly
- **THEN** the system MAY deliver raw terminal output through Protocol 1
- **AND** the target remains responsible for terminal emulation semantics at that edge

#### Scenario: Dumb renderer consumes protocol 2
- **WHEN** a target does not own terminal emulation semantics
- **THEN** the system SHALL deliver backend-authored screen cells, frames, or diffs through Protocol 2
- **AND** the target SHALL NOT reinterpret ANSI, OSC, SGR, scrollback, wrapping, cursor, or wide-character terminal semantics

#### Scenario: Protocol 2 remains derived from backend truth
- **WHEN** Protocol 2 is used for a PTY-backed source terminal
- **THEN** its screen truth SHALL derive from backend interpretation of the source terminal raw bytes
- **AND** it SHALL NOT create a second frontend-owned terminal state machine

### Requirement: Shell offscreen renderer SHALL emit a complete shell projection frame

The shell offscreen renderer SHALL emit shell content, scrollbar, focus, selection, cursor, and wrapping as one cell-locked shell projection frame. A compositor MAY position that frame, but it MUST NOT split those shell concerns into separate external decorations.

#### Scenario: Shell frame includes shell interaction projection
- **WHEN** terminal-1 shell truth is rendered for cli-shell composition
- **THEN** the shell offscreen renderer emits shell cells together with shell scrollbar, focus, selection, cursor, and wrapping projection
- **AND** the terminal-2 compositor does not add those concerns later as independent host-local decorations

#### Scenario: Selection stays inside shell frame ownership
- **WHEN** the user selects shell text
- **THEN** the selection visual and copy extraction SHALL belong to the shell offscreen renderer path
- **AND** terminal-2 SHALL NOT maintain a second shell selection truth

#### Scenario: Scrollbar stays inside shell frame ownership
- **WHEN** the shell region renders a visible scrollbar
- **THEN** the scrollbar SHALL be part of the shell offscreen renderer frame
- **AND** shell scrollbar state SHALL remain bound to shell viewport truth rather than compositor-local decoration state

### Requirement: Offscreen renderers SHALL support configurable visual chrome without removing interaction truth

Offscreen renderers SHALL support visual chrome configuration such as showing or hiding scrollbars. Hiding visual chrome MUST NOT remove scroll, viewport, cursor, selection, wrapping, or copy truth from the backend or offscreen renderer.

#### Scenario: Dialogue renderer hides visual scrollbar
- **WHEN** terminal-chat renders dialogue content with scrollbar chrome hidden
- **THEN** the dialogue frame omits the visual scrollbar
- **AND** terminal-chat still owns scrollBox offset, viewport, selection, cursor, wrapping, and copy extraction

#### Scenario: Hidden scrollbar does not remove scroll capability
- **WHEN** the dialogue scrollbar is hidden
- **THEN** wheel, keyboard, or pointer scroll requests targeting dialogue SHALL still route to terminal-chat scroll ownership
- **AND** terminal-2 SHALL NOT invent a replacement dialogue scroll state

### Requirement: Terminal-chat SHALL use an independent backend before no-backend optimization

Terminal-chat SHALL use an independent OpenTUI dialogue backend instance in the first implementation. The system MUST NOT replace that backend with hand-rolled dialogue selection, copy, scroll, cursor, or wrapping algorithms in terminal-2 or host adapter code before the independent backend path is stable and accepted.

#### Scenario: Dialogue backend owns reusable interaction law
- **WHEN** terminal-chat is implemented for cli-shell
- **THEN** it SHALL use an independent OpenTUI backend instance and the shared offscreen renderer/event-bridge law
- **AND** selection, copy, scroll, cursor, and wrapping SHALL be owned by that backend path

#### Scenario: Terminal-2 does not hand-roll dialogue algorithms
- **WHEN** terminal-2 composes dialogue into the final app screen
- **THEN** terminal-2 SHALL consume terminal-chat's offscreen frame
- **AND** it SHALL NOT implement separate dialogue selection, copy, scroll, cursor, or wrapping algorithms as a replacement for terminal-chat backend ownership

#### Scenario: No-backend optimization waits for stability
- **WHEN** a future implementation proposes a no-backend terminal-chat optimization
- **THEN** the independent backend route SHALL already have passed acceptance
- **AND** the optimization SHALL preserve the same observable dialogue selection, copy, scroll, cursor, wrapping, and event-routing contract

### Requirement: Terminal-2 SHALL be the final composed app screen truth

Terminal-2 SHALL be the final composed cli-shell app screen truth. Native and Web hosts SHALL render terminal-2 rather than rendering terminal-1 or host-local approximations of the app surface.

#### Scenario: Terminal-2 composes shell and dialogue frames
- **WHEN** cli-shell builds the final visible app screen
- **THEN** terminal-2 SHALL compose the shell offscreen frame, terminal-chat frame, and app chrome into one final screen
- **AND** terminal-2 SHALL publish that final screen as the app truth consumed by hosts

#### Scenario: Native host renders terminal-2
- **WHEN** cli-shell runs in native mode
- **THEN** the native host SHALL render terminal-2 final app screen through the current process output path
- **AND** it SHALL NOT keep accepted app chrome only in host-local OpenTUI overlays
- **AND** it SHALL NOT open a pull/readback transport session for terminal-2 from the same native process

#### Scenario: Web host renders terminal-2
- **WHEN** cli-shell runs in `--web` mode
- **THEN** the Web host SHALL render terminal-2 final app screen
- **AND** it SHALL NOT render only terminal-1 shell truth or a reduced debugging-only surface

### Requirement: Terminal-2 SHALL NOT require a child PTY process

Terminal-2 SHALL be allowed to be a composed terminal runtime without a child PTY process. It SHALL still have terminal identity, geometry, frame publication, event routing, and raw-output adapter capability.

#### Scenario: Composed terminal publishes without fake PTY
- **WHEN** terminal-2 is composed from terminal-1 shell frame, terminal-chat frame, and app chrome
- **THEN** terminal-2 SHALL publish terminal screen truth without requiring a fake shell child process
- **AND** the implementation SHALL NOT perform an unnecessary cells-to-ANSI-to-cells round trip just to make terminal-2 look like a terminal

#### Scenario: Raw adapter is an output boundary
- **WHEN** terminal-2 output must reach a raw-capable target such as Ghostty or a browser terminal renderer
- **THEN** terminal-2 MAY encode its final screen truth into raw output as an adapter boundary
- **AND** that raw adapter SHALL NOT become terminal-2's source of truth

### Requirement: Host events SHALL route to the region backend that owns interaction truth

Host keyboard, mouse, wheel, drag, resize, and copy events SHALL route through terminal-2 hit-testing to the backend or offscreen renderer that owns the targeted interaction truth.

#### Scenario: Shell event routes to shell owner
- **WHEN** a host event targets the shell region
- **THEN** terminal-2 SHALL route the event to the shell offscreen renderer or terminal-1 interaction path
- **AND** terminal-chat SHALL NOT observe that event as dialogue input

#### Scenario: Dialogue event routes to terminal-chat owner
- **WHEN** a host event targets the dialogue region
- **THEN** terminal-2 SHALL route the event to terminal-chat OpenTUI backend
- **AND** shell selection, shell scroll, and shell cursor truth SHALL NOT change from that dialogue event

#### Scenario: Final visible result returns through terminal-2
- **WHEN** an owning backend updates state after a routed event
- **THEN** terminal-2 SHALL compose and publish the next final app screen
- **AND** native and Web hosts SHALL observe the result from terminal-2 rather than applying independent host-local paint fixes

### Requirement: Frame transport SHALL keep input drain dirty clock and pull delivery orthogonal

Protocol 2 frame transport SHALL split backend input drain, backend dirty detection, and client pull/draw delivery into independent loops. Frontends SHALL objectively forward viewport events; backend control-plane SHALL own scroll coalescing and viewport truth; frontend drawing SHALL replay backend cells rather than rerendering from input events.

#### Scenario: Backend coalesces only consecutive scroll runs
- **WHEN** a WebSocket attachment receives many queued client messages
- **THEN** the backend SHALL drain them in order
- **AND** consecutive `viewportDelta` messages MAY be summed into one backend `scrollViewport(delta)` call
- **AND** semantic events such as input bytes, click, resize, `viewportTarget`, or `pullFrame` SHALL flush the current scroll run before the event is handled

#### Scenario: Frontend does not merge scroll meaning
- **WHEN** the user continuously scrolls with a wheel, trackpad, scrollbar drag, or scrollbar click
- **THEN** the frontend SHALL send objective `viewportDelta` or `viewportTarget` events
- **AND** it SHALL NOT locally merge those events into a separate viewport truth or carry a host-local viewport selector inside `pullFrame`
- **AND** it SHALL NOT treat those input events as local screen refresh requests

#### Scenario: Backend viewport input does not bypass frame pacing
- **WHEN** the backend applies `viewportDelta` or `viewportTarget`
- **THEN** it SHALL mutate backend viewport truth and stop there
- **AND** it SHALL NOT synchronously send `frameDirty` just because the viewport input arrived
- **AND** it SHALL NOT create a direct pull activation path from scroll or viewport input
- **AND** the visible viewport SHALL be observed by the shared dirty clock or by the client's next paced `pullFrame`

#### Scenario: Dirty loop is shared per terminal with per-connection dirty state
- **WHEN** multiple WebSocket attachments observe the same terminal backend
- **THEN** the backend SHALL run one shared dirty clock for that terminal, defaulting to 30 FPS
- **AND** each attachment SHALL keep its own `dirtyOutstanding` state
- **AND** a dirty signal SHALL be sent only to an attachment that has consumed its previous dirty signal by pulling a frame

#### Scenario: Dirty check compares backend text plus visible viewport facts
- **WHEN** the dirty loop checks whether a terminal's visible frame changed
- **THEN** it SHALL use the backend-optimized `getText()` value as the primary comparison source
- **AND** it SHALL include viewport and cursor facts needed for visible-frame changes such as scroll movement

#### Scenario: Client pull loop is paint paced
- **WHEN** a client is connected to a screen-frame backend
- **THEN** it SHALL default to fixed 30 FPS pull pacing
- **AND** it SHALL only schedule the next pull after the previous pulled frame has been handled and any required paint has committed
- **AND** dirty signals SHALL inform what the next paced pull may return, not create one pull request per input event
- **AND** it SHALL NOT create one pull request per scroll event

#### Scenario: Backend frame projection owns selection copy action and viewport chrome together
- **WHEN** a native host projects a backend-rendered terminal frame into OpenTUI
- **THEN** the projection component SHALL own cell replay, bounded text selection, OSC52 copy action, paste input bridge, scrollbar chrome, and keyboard/mouse event bridging as one unit
- **AND** OSC52 SHALL be the unified clipboard write path for selected projection text
- **AND** text paste SHALL be modeled as host paste-event bytes routed into the backend input path, not as an OSC52 clipboard read
- **AND** media paste SHALL be modeled as a MIME-aware media paste fact and routed to room asset / attachment ownership or explicit unsupported handling
- **AND** image paste SHALL NOT be written into shell stdin as plain text or raw binary bytes
- **AND** concrete copy shortcuts SHALL be treated as keybinding policy outside the projection component
- **AND** app entrypoints SHALL NOT reimplement selection or paste handling outside this projection component

#### Scenario: Experimental dynamic refresh is opt-in
- **WHEN** experimental dynamic refresh is explicitly enabled
- **THEN** a dirty signal MAY raise the client cadence to active 30 FPS
- **AND** the client MAY fall back to 1 FPS only after its own pulled drawable cells have stayed unchanged for the quiet window
- **AND** dynamic refresh SHALL be treated as a power-saving optimization, not the default correctness path

#### Scenario: Codec-level notModified preserves unchanged-frame pacing without duplicate app work
- **WHEN** a paced pull observes the same serialized viewport rows, cursor, and viewport facts as the last real row-cache frame
- **THEN** the backend MAY return a transport-level `notModified` patch
- **AND** the client SHALL consume that server frame for pacing without requesting a paint
- **AND** `notModified` SHALL NOT advance the row-cache decoder base frame for future cid-only rows
- **AND** app code SHALL NOT add an independent visible-frame duplicate skip before serialization

#### Scenario: Pulled cells replay through one paint path
- **WHEN** the client receives a pulled frame
- **THEN** the client SHALL update its latest frame cache and request exactly one frame-buffer replay for that frame
- **AND** mirror subscription or transport status events SHALL NOT form a second cells redraw trigger for the same frame
- **AND** the redraw path SHALL replay received cells into the OpenTUI frame buffer instead of rebuilding terminal cells from input events

#### Scenario: JavaScript event loop preserves current vertical sync boundary
- **WHEN** this transport runs in the current JavaScript backend
- **THEN** the implementation SHALL rely on event-loop ordering for messages already queued before `pullFrame`
- **AND** it does not need a separate pre-pull scroll flush beyond the normal input drain semantics
- **AND** a future multi-threaded runtime SHALL revisit this vertical synchronization boundary before reusing the same assumption

#### Scenario: Same-process direct data plane preserves WebSocket control-plane truth
- **WHEN** a Bun client connects from the same process and same pid as the backend
- **THEN** the initial WebSocket `hello` / `helloAck` handshake MAY negotiate a same-process direct data plane
- **AND** WebSocket SHALL remain the bootstrap lifecycle credential and fallback control plane
- **AND** the direct path SHALL carry the same semantic terminal messages as function calls into the backend input drain
- **AND** the direct path SHALL NOT become a second terminal truth app-layer shortcut or BroadcastChannel-specific dependency
- **AND** a direct upgrade token SHALL be claimable only once for one accepted client
