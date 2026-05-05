## Purpose

Define the standalone terminal-view WebComponent contract and its shared controller semantics.
## Requirements
### Requirement: The system SHALL provide a standalone terminal-view WebComponent

The system SHALL provide a standalone `terminal-view` WebComponent implemented with a shared terminal controller contract and renderer stack adapter contract, and renderer hosts SHALL be able to embed it as a pure terminal viewport without depending on WebUI-local terminal internals or renderer-private DOM internals.

#### Scenario: Embed terminal-view in a host surface
- **WHEN** a host page instantiates `terminal-view` with a valid terminal transport target
- **THEN** the component renders the terminal viewport and manages its own renderer lifecycle
- **THEN** the host does not need direct access to WebUI-specific terminal internals
- **AND** the host does not depend on renderer-private DOM classes or hidden metric objects

#### Scenario: Explicit wterm still embeds through the same element contract
- **WHEN** a host selects resolved renderer `wterm`
- **THEN** it still mounts the same `terminal-view` element
- **AND** no host-local special case is required for `GhosttyCore` loading or `WTerm` hosting

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
