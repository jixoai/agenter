> Superseded note:
> This delta spec is built on the older `terminal-1` / `terminal-2` cli-shell ontology.
> It remains only as historical analysis and reference input. Current work must follow `realign-cli-shell-with-core-system-boundaries`.

## MODIFIED Requirements

### Requirement: The system SHALL provide `web-terminal-view` and `shell-terminal-view` as one component family over the same termless substrate

The system SHALL provide `web-terminal-view` for Web hosts and `shell-terminal-view` for native terminal hosts. Both roles SHALL sit on the same termless substrate: canonical backend screen truth is shared, while protocol-2 style product-surface decoding/rendering for native hosts consumes backend-authored composition truth built on top of that substrate. Raw terminal bytes may still exist at boundary adapters, but they are not the reusable component family's only shared synchronization law. `web-terminal-view` SHALL NOT be treated as debugging-only, and `shell-terminal-view` SHALL NOT be used as the product name.

#### Scenario: Web host embeds `web-terminal-view`
- **WHEN** a Web host instantiates `web-terminal-view` with a valid terminal projection target
- **THEN** the component renders the terminal projection for that host
- **AND** the host does not need cli-shell-specific internals just to consume the component

#### Scenario: Native host embeds `shell-terminal-view`
- **WHEN** a native terminal product such as `cli-shell` instantiates `shell-terminal-view`
- **THEN** the component renders the same backend terminal truth back into the native terminal host
- **AND** the component contract remains reusable outside that single product

#### Scenario: Native decoder stays derived from the shared substrate
- **WHEN** a native terminal product such as `cli-shell` instantiates `shell-terminal-view`
- **THEN** it decodes and renders backend-authored terminal truth on top of the shared canonical terminal substrate
- **AND** it does not redefine a second independent transport contract or a second host-local product-surface truth

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

### Requirement: Shell-terminal-view SHALL keep backend terminal rows out of host text-flow re-layout

`shell-terminal-view` SHALL keep backend terminal rows inside a cell-locked projection pipeline. Native host composition MAY use container, focus, or pointer primitives, but it SHALL NOT hand backend terminal rows to a generic host text-flow renderer that can re-wrap, re-measure, or restyle them as ordinary text content.

#### Scenario: Native terminal projection does not re-wrap backend rows through host text layout
- **WHEN** `shell-terminal-view` renders backend terminal rows into the native host
- **THEN** the visible shell body stays cell-locked to backend terminal truth
- **AND** the native host does not apply a second ordinary-text layout law to those rows

#### Scenario: Long shell lines do not corrupt the visible native surface through host reflow
- **WHEN** the attached shell emits long prompts, wide glyphs, or repeated input that spans the available width
- **THEN** the visible terminal surface remains a single coherent terminal projection
- **AND** the native host does not introduce line duplication, cursor drift, or style fragmentation from generic text reflow

### Requirement: Geometry authority SHALL remain explicit across the component family

When backend terminal geometry is currently owned by `shell-terminal-view` inside `cli-shell`, `web-terminal-view` attachments may fit, cover, or scale that geometry locally but SHALL NOT silently become geometry authority.

#### Scenario: Shell-terminal-view-owned geometry stays authoritative
- **WHEN** `shell-terminal-view` is the current geometry authority for a shared terminal
- **THEN** backend columns and rows remain bound to that authority
- **AND** projection-only attachments consume that geometry as shared truth

#### Scenario: Web-terminal-view scales without rewriting backend geometry
- **WHEN** a `web-terminal-view` host changes its local layout or zoom
- **THEN** it may recompute local presentation from the shared terminal grid
- **AND** it does not silently rewrite backend columns and rows while another host still owns geometry authority

### Requirement: Terminal-view components SHALL reflect shared viewport truth across same-terminal attachments

When `web-terminal-view` and `shell-terminal-view` are attached to the same backend terminal through the shared terminal contract, they SHALL reflect the same visible viewport truth instead of diverging into host-local scroll ownership.

#### Scenario: Shell-terminal-view pointer scroll is reflected in web-terminal-view
- **GIVEN** one `shell-terminal-view` attachment and one `web-terminal-view` attachment are connected to the same backend terminal
- **WHEN** the native attachment scrolls the shared viewport through pointer, wheel, scrollbar, or equivalent scroll interaction
- **THEN** the Web attachment renders the same visible viewport position
- **AND** the synchronized result comes from shared terminal truth rather than a Web-local replay

#### Scenario: Web-terminal-view pointer scroll is reflected in shell-terminal-view
- **GIVEN** one `shell-terminal-view` attachment and one `web-terminal-view` attachment are connected to the same backend terminal
- **WHEN** the Web attachment scrolls the shared viewport through pointer, wheel, scrollbar, or equivalent scroll interaction
- **THEN** the native attachment renders the same visible viewport position
- **AND** the synchronized result comes from shared terminal truth rather than a native-local mirror

#### Scenario: Visible scrollbar remains a projection of backend viewport truth
- **WHEN** a terminal-view component renders a visible scrollbar for a shared terminal
- **THEN** that scrollbar reflects backend-authored viewport position and extent
- **AND** dragging, wheel, or pointer interaction routes back through the shared backend viewport-mutation path, including absolute viewport-target requests where the host exposes direct thumb positioning
- **AND** the scrollbar does not become a host-local scroll owner
