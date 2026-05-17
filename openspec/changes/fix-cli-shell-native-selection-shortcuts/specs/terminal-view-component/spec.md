## ADDED Requirements

### Requirement: Native shell-terminal-view SHALL route renderable drag lifecycle to backend selection

When OpenTUI native projection receives renderable-level mouse lifecycle events, `shell-terminal-view` SHALL route real drag selection to the backend owner. The projection layer MUST NOT require OpenTUI's global `Selection` object to be the only source of drag lifecycle truth.

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

### Requirement: Terminal-view selection debug traces SHALL identify native event capture

When selection debug tracing is enabled, terminal-view components SHALL record enough facts to distinguish native mouse capture from backend routing.

#### Scenario: Debug trace shows captured mouse lifecycle
- **WHEN** `--debug=selection` is enabled and the user presses, drags, or releases in `shell-terminal-view`
- **THEN** the trace SHALL include renderable mouse event type, button, host coordinates, owner coordinates when available, and bridge state
- **AND** the trace SHALL make it clear whether backend selection routing was attempted
