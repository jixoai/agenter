## Purpose

Define the shared terminal-view component family contract and its shared controller semantics.
## Requirements
### Requirement: The system SHALL provide a standalone terminal-view WebComponent

The system SHALL provide a standalone `terminal-view` WebComponent implemented with a shared terminal controller contract and renderer stack adapter contract. The component SHALL consume backend-neutral terminal transport and snapshot truth, and renderer hosts SHALL be able to embed it as a pure terminal viewport without depending on WebUI-local terminal internals, renderer-private DOM internals, or Agenter-private backend package identity.

#### Scenario: Embed terminal-view in a host surface
- **WHEN** a host page instantiates `terminal-view` with a valid terminal transport target
- **THEN** the component renders the terminal viewport and manages its own renderer lifecycle
- **THEN** the host does not need direct access to WebUI-specific terminal internals
- **AND** the host does not depend on renderer-private DOM classes or hidden metric objects

#### Scenario: Explicit wterm still embeds through the same element contract
- **WHEN** a host selects resolved renderer `wterm`
- **THEN** it still mounts the same `terminal-view` element
- **AND** no host-local special case is required for `GhosttyCore` loading or `WTerm` hosting

#### Scenario: Host does not pass Agenter-private backend identity into terminal-view

- **WHEN** a host binds `terminal-view` to a running terminal
- **THEN** the host passes transport, snapshot, and shared presentation facts
- **AND** it does not need to pass or infer an Agenter-private backend package identity just to render the terminal

### Requirement: Terminal-view SHALL consume websocket PTY transport

The component SHALL connect to the terminal-system websocket PTY transport contract and use that stream as its terminal data source. It SHALL also accept durable snapshot hydration from the host so the surface remains renderable while the live websocket is connecting or recovering.

#### Scenario: Connect terminal-view to a running terminal
- **WHEN** the component is given a websocket PTY endpoint for a running terminal
- **THEN** it opens the websocket connection and renders incoming PTY output
- **THEN** it surfaces connection loss or terminal shutdown through a stable component state

#### Scenario: Snapshot hydrates before live transport is ready
- **WHEN** the host passes a durable terminal snapshot while live transport is still connecting
- **THEN** the component renders the snapshot immediately
- **THEN** live PTY output takes over without clearing the already rendered viewport

#### Scenario: Stable transport URL reconnects after lifecycle restart
- **WHEN** the host keeps the same durable websocket URL but disables live transport because the terminal has stopped
- **THEN** the component moves to an idle live-transport state without discarding snapshot hydration
- **AND** when the host re-enables live transport on that same URL after bootstrap, the component opens a fresh websocket connection instead of staying closed

#### Scenario: Snapshot stays renderable while live transport is disabled
- **WHEN** the host disables live transport for a stopped terminal that still has snapshot truth
- **THEN** the component keeps rendering the current snapshot viewport
- **AND** it does not require the host to clear transport discovery just to prevent stale live websocket activity

### Requirement: Terminal-view SHALL preserve stable live rendering

The terminal renderer SHALL preserve ANSI rendering fidelity and stable fit-driven resizing while live transport is active. Once live transport has hydrated the viewport, redundant same-geometry fallback snapshots SHALL NOT trigger another reactive rehydration cycle.

#### Scenario: Live transport does not jitter under fallback updates
- **WHEN** live websocket transport is connected and fallback snapshots continue to update
- **THEN** the renderer does not reset backwards or visibly jitter
- **THEN** fallback hydration only applies when live transport is unavailable or behind

#### Scenario: Redundant live snapshots do not retrigger fallback hydration

- **WHEN** live websocket transport is already connected and a new snapshot arrives with the same terminal geometry
- **THEN** the component does not reset or rehydrate the viewport from that redundant snapshot
- **AND** live output remains the primary render source

#### Scenario: Geometry change still allows fallback rehydration

- **WHEN** a new snapshot arrives with a changed terminal geometry
- **THEN** the component may rehydrate from that snapshot to realign the viewport
- **AND** the live transport stays connected through that recovery

### Requirement: Terminal-view SHALL support terminal-local presentation controls

The integrated terminal viewport SHALL expose terminal-local presentation controls including `fit` and `cover`, while leaving non-terminal product chrome to the host.

#### Scenario: Switch between fit and cover modes
- **WHEN** the host toggles between `fit` and `cover`
- **THEN** the terminal viewport updates its presentation mode
- **THEN** live transport remains connected and terminal content stays readable

### Requirement: Terminal-view SHALL behave as a viewport primitive

The standalone `terminal-view` component SHALL own terminal renderer lifecycle, renderer resolution, snapshot hydration, live transport updates, and viewport sizing only. Product-level chrome such as titlebars, metadata footers, and decorative backgrounds MUST remain in the host surface.

#### Scenario: Host owns product chrome
- **WHEN** a host embeds `terminal-view`
- **THEN** the component renders the terminal viewport without product-level title or footer chrome
- **THEN** the host remains responsible for surrounding shell visuals and metadata placement

#### Scenario: Renderer-private helpers stay inside the viewport primitive
- **WHEN** one concrete renderer requires hidden textarea focus proxies, canvas measurement, or renderer-private addons
- **THEN** those concerns stay inside the viewport primitive and its renderer adapter
- **AND** host surfaces do not take ownership of renderer-private helper mechanics

### Requirement: Terminal-view SHALL consume one shared terminal presentation profile

The standalone `terminal-view` component SHALL consume shared declarative `rendererPreference`, `theme`, `cursor`, and `font` inputs and apply them through the resolved renderer stack.

#### Scenario: Adapter policy decides between live-apply and rebuild
- **WHEN** the host updates terminal theme, cursor, or font while the resolved renderer stays the same
- **THEN** `terminal-view` asks the resolved renderer adapter whether the mutation can settle through `live-apply` or requires `rebuild-session`
- **AND** it does not fabricate a new PTY or second terminal id

#### Scenario: Renderer preference change rebuilds only the local renderer stack
- **WHEN** the host updates renderer preference or the resolved renderer changes
- **THEN** `terminal-view` disposes and recreates only the local renderer stack
- **AND** the websocket transport, terminal id, and durable snapshot truth remain attached to the same terminal session

#### Scenario: Terminal-view owns optional webfont asset preparation
- **WHEN** the shared terminal font profile selects an optional terminal webfont
- **THEN** `terminal-view` injects and prepares that font asset from its own package boundary before renderer settle
- **AND** the terminal surface remains logically complete without requiring host-global font imports

### Requirement: Terminal-view SHALL emit an explicit presentation-ready fact

After a presentation mutation settles, `terminal-view` SHALL emit one renderer-settled event so hosts can distinguish durable config writes from visible renderer completion.

#### Scenario: Live-apply mutation emits ready event
- **WHEN** the resolved renderer settles a presentation mutation through `live-apply`
- **THEN** `terminal-view` emits `terminal-view-presentation-ready`
- **AND** the event includes the terminal id, resolved renderer, settle reason, and current screen metrics

#### Scenario: Stable resolved renderer preference still emits ready event
- **WHEN** the durable renderer preference changes but the resolved renderer stays the same and no rebuild is required
- **THEN** `terminal-view` still emits `terminal-view-presentation-ready`
- **AND** host apply state can terminate without guessing

### Requirement: Terminal-view SHALL restore the current snapshot after renderer rebuild

When `terminal-view` rebuilds its local renderer stack, it SHALL restore the current snapshot truth into the fresh renderer session even if the snapshot sequence has not advanced.

#### Scenario: Rebuild does not leave the viewport blank
- **WHEN** a renderer mutation requires `rebuild-session`
- **AND** the current durable snapshot sequence stays unchanged
- **THEN** the fresh renderer session still hydrates from the current snapshot
- **AND** the visible viewport does not remain blank while waiting for future PTY output

#### Scenario: XTerm-to-ghostty-web swap repaints immediately
- **WHEN** the host changes renderer preference from `xterm` to `ghostty-web`
- **AND** the current durable snapshot already contains renderable terminal content
- **THEN** the rebuilt `ghostty-web` session paints that snapshot without requiring future PTY output
- **AND** the operator does not need to type another command just to reveal the old buffer

### Requirement: Terminal-view SHALL report renderer-native content metrics

The standalone `terminal-view` component SHALL report renderer-owned native content metrics that hosts can use as geometry truth for fit/cover projection.

#### Scenario: Renderer-native metrics survive fit projection
- **WHEN** the host renders `terminal-view` inside a fit projection smaller than native scale
- **THEN** the component still reports native content metrics for the current renderer session
- **AND** the host does not need to reconstruct intrinsic size by dividing projected dimensions

### Requirement: The system SHALL provide `web-terminal-view` and `shell-terminal-view` as one component family over the same termless substrate

The system SHALL provide `web-terminal-view` for Web hosts and `shell-terminal-view` for native terminal hosts. Both roles SHALL sit on the same termless substrate: raw terminal transport is shared, while shell-native protocol-2 decoding/rendering consumes backend-authored screen-projection truth built on top of that same substrate. `web-terminal-view` SHALL NOT be treated as debugging-only, and `shell-terminal-view` SHALL NOT be used as the product name.

#### Scenario: Web host embeds `web-terminal-view`
- **WHEN** a Web host instantiates `web-terminal-view` with a valid terminal projection target
- **THEN** the component renders the terminal projection for that host
- **AND** the host does not need cli-shell-specific internals just to consume the component

#### Scenario: Native host embeds `shell-terminal-view`
- **WHEN** a native terminal product such as `cli-shell` instantiates `shell-terminal-view`
- **THEN** the component renders the same backend terminal truth back into the native terminal host
- **AND** the component contract remains reusable outside that single product

#### Scenario: Native protocol-2 rendering stays derived from the raw substrate
- **WHEN** a native terminal product such as `cli-shell` instantiates `shell-terminal-view`
- **THEN** it decodes/renders backend-authored terminal projection truth built on top of the raw transport substrate
- **AND** it does not redefine a second independent transport contract

#### Scenario: Future Web products reuse the same Web component family
- **WHEN** a future product such as `agenter shell --web` wants to embed the shared terminal projection
- **THEN** it can consume `web-terminal-view`
- **AND** the component is not blocked by a "debug-only" classification

### Requirement: Terminal-view components SHALL remain pure projections of backend terminal truth

`web-terminal-view` and `shell-terminal-view` SHALL project backend terminal truth without constructing a second authoritative terminal state machine. Hosts MAY cache render data for efficiency, but they SHALL NOT redefine authoritative terminal buffer state, cursor state, or viewport truth.

#### Scenario: Host projects backend truth without second terminal authority
- **WHEN** a host embeds `web-terminal-view` or `shell-terminal-view` for a running terminal
- **THEN** the host renders backend-provided terminal truth through the projection component
- **AND** the host does not create another authoritative terminal state machine for that same terminal

#### Scenario: Projection cache does not become authoritative viewport truth
- **WHEN** a host keeps local projection caches for rendering or batching
- **THEN** those caches remain derivative of backend terminal truth
- **AND** they do not replace backend truth for cursor, scrollback, or viewport ownership

### Requirement: Terminal-view components SHALL preserve one continuous renderer surface per terminal truth

Projection components SHALL preserve one continuous renderer surface for a terminal, including scrollback and current viewport content. They SHALL NOT split the same terminal into a rich live region and a plain-text mirror with weaker fidelity.

#### Scenario: Scrollback retains renderer fidelity after further shell output
- **WHEN** a terminal already has colorized scrollback and new shell output continues to arrive
- **THEN** older rows remain part of the same renderer surface
- **AND** the component does not downgrade earlier rows into a separate plain-text projection

#### Scenario: Reprojection still restores one continuous terminal surface
- **WHEN** a component reconnects or rehydrates from snapshot truth
- **THEN** scrollback and current rows restore through one projection pipeline
- **AND** the visible terminal does not fragment into multiple fidelity tiers

### Requirement: Geometry authority SHALL remain explicit across the component family

When backend terminal geometry is currently owned by one native attachment, `web-terminal-view` attachments may fit, cover, or scale that geometry locally but SHALL NOT silently become geometry authority.

#### Scenario: Native attachment geometry stays authoritative
- **WHEN** one native terminal attachment is the current geometry authority for a shared terminal
- **THEN** backend columns and rows remain bound to that authority
- **AND** projection-only attachments consume that geometry as shared truth

#### Scenario: Web-terminal-view scales without rewriting backend geometry
- **WHEN** a `web-terminal-view` host changes its local layout or zoom
- **THEN** it may recompute local presentation from the shared terminal grid
- **AND** it does not silently rewrite backend columns and rows while another host still owns geometry authority

### Requirement: Terminal-view components SHALL reflect shared viewport truth across same-terminal attachments

When `web-terminal-view` and `shell-terminal-view` are attached to the same backend terminal through the shared terminal contract, they SHALL reflect the same visible viewport truth instead of diverging into host-local scroll ownership.

#### Scenario: Shell-terminal-view scroll is reflected in web-terminal-view
- **GIVEN** one `shell-terminal-view` attachment and one `web-terminal-view` attachment are connected to the same backend terminal
- **WHEN** the native attachment scrolls the shared viewport
- **THEN** the Web attachment renders the same visible viewport position
- **AND** the synchronized result comes from shared terminal truth rather than a Web-local replay

#### Scenario: Web-terminal-view scroll is reflected in shell-terminal-view
- **GIVEN** one `shell-terminal-view` attachment and one `web-terminal-view` attachment are connected to the same backend terminal
- **WHEN** the Web attachment scrolls the shared viewport
- **THEN** the native attachment renders the same visible viewport position
- **AND** the synchronized result comes from shared terminal truth rather than a native-local mirror

### Requirement: Terminal-view components SHALL render backend-owned interaction overlays

`web-terminal-view` and `shell-terminal-view` SHALL render backend-owned interaction overlays such as selection ranges, cursor state, focus projection, and visible scrollbar state as projections of backend truth. These components SHALL NOT turn rendered overlays into a second terminal interaction authority.

#### Scenario: Shell-terminal-view paints backend selection overlay
- **WHEN** a terminal frame includes backend selection overlay rows
- **THEN** `shell-terminal-view` SHALL paint those selected cell ranges
- **AND** it SHALL NOT compute selected text from the painted overlay as durable copy truth

#### Scenario: Web-terminal-view clears stale overlay from backend truth
- **WHEN** a later terminal frame omits selection overlay for an owner
- **THEN** `web-terminal-view` SHALL clear the prior visible selection for that owner
- **AND** it SHALL NOT preserve a host-local selection highlight after backend selection is gone

### Requirement: Terminal-view components SHALL route terminal interaction events without owning selection truth

Terminal-view components SHALL capture pointer, drag, wheel, keyboard, paste, copy, focus, and resize events and route them to the backend or offscreen renderer that owns the target region. Event capture and coordinate mapping are projection responsibilities; terminal selection, copy, cursor-follow, scrollback, and wrapping truth are backend responsibilities.

#### Scenario: Pointer drag routes to backend selection owner
- **WHEN** the user drags inside a terminal owner region
- **THEN** the terminal-view component SHALL route start/update/end selection events to the backend interaction owner
- **AND** it SHALL NOT store the drag range as durable terminal selection truth

#### Scenario: Renderable drag starts backend selection only after movement
- **WHEN** the user presses inside an owner region and releases without dragging
- **THEN** `shell-terminal-view` SHALL NOT send backend selection start, update, or end
- **AND** no backend selection overlay is fabricated by host projection

#### Scenario: Renderable drag routes backend selection lifecycle
- **WHEN** the user presses inside an owner region and drags to another cell in the same owner
- **THEN** `shell-terminal-view` SHALL send backend selection start, update, and end using owner coordinates
- **AND** selected text and overlay truth remain backend-owned

#### Scenario: Renderable drag stays inside one owner
- **WHEN** a drag starts inside shell or dialogue and moves across another owner region
- **THEN** `shell-terminal-view` SHALL keep the selection owner from the drag start
- **AND** it SHALL NOT merge shell, dialogue, scrollbar, or product chrome into one host-local range

#### Scenario: Selection overlay follows backend content through scroll round trip
- **WHEN** a backend owner has selected text and the user scrolls the viewport down and back up
- **THEN** `shell-terminal-view` SHALL project the overlay onto the selected backend content whenever that content is visible
- **AND** it SHALL NOT leave the overlay stuck to the old screen row

#### Scenario: Single click clears backend-owned selection
- **WHEN** a backend owner has an active selection and the user single-clicks inside that owner without dragging
- **THEN** `shell-terminal-view` SHALL route a backend clear-selection request for that owner
- **AND** it SHALL NOT create a new host-local selection

#### Scenario: Copy routes to active backend owner
- **WHEN** the user invokes copy while a backend owner has an active selection
- **THEN** the terminal-view component SHALL request selected text from that owner
- **AND** native shell projection MAY deliver the result through OSC 52 or another host clipboard adapter

#### Scenario: Cursor-follow routes to backend owner
- **WHEN** terminal-view accepts printable or supported navigation input
- **THEN** it SHALL route cursor-follow to the backend owner after the input is accepted
- **AND** it SHALL NOT compute a frontend-only viewport target from a previously pulled frame

### Requirement: OpenTUI native projection SHALL keep selection state out of FrameBufferRenderable truth

When OpenTUI core primitives are used for native projection, `FrameBufferRenderable`-based renderers SHALL draw backend cells and overlays only. OpenTUI selection objects MAY be used as raw input signals during migration, but they MUST NOT remain the source of terminal selected text, scrollback selection ranges, or semantic word/row selection truth.

#### Scenario: FrameBufferRenderable receives backend overlay instead of local selection truth
- **WHEN** backend-owned selection changes
- **THEN** the OpenTUI frame renderer SHALL receive updated overlay data through projection state
- **AND** the renderer SHALL repaint from that data rather than from an OpenTUI-local selected range

#### Scenario: Local OpenTUI selection cannot outlive backend selection
- **WHEN** backend selection is cleared or moves outside the viewport
- **THEN** the OpenTUI renderer SHALL clear the visible selection projection
- **AND** any local OpenTUI selection object SHALL NOT keep the old selection alive

### Requirement: Terminal-view debug traces SHALL expose interaction ownership

When debug tracing is enabled for interaction filters, terminal-view components SHALL log enough information to prove event target owner, backend action, selected range publication, cursor-follow request, and viewport result without requiring native app automation.

#### Scenario: Selection debug trace identifies owner
- **WHEN** `--debug=selection` is enabled and the user starts a selection
- **THEN** debug output SHALL identify the owner region, backend coordinates, and backend action name
- **AND** it SHALL distinguish backend-owned overlay publication from host-local event capture

#### Scenario: Debug trace shows captured mouse lifecycle
- **WHEN** `--debug=selection` is enabled and the user presses, drags, or releases in `shell-terminal-view`
- **THEN** the trace SHALL include renderable mouse event type, button, host coordinates, owner coordinates when available, and bridge state
- **AND** the trace SHALL make it clear whether backend selection routing was attempted

#### Scenario: Follow debug trace identifies backend result
- **WHEN** `--debug=follow` is enabled and cursor-follow is requested
- **THEN** debug output SHALL identify the request reason and the backend-published viewport result
- **AND** it SHALL not report a frontend-only target as completion truth
