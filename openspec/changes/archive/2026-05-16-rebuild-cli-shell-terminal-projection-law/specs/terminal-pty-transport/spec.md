## ADDED Requirements

### Requirement: Raw PTY transport SHALL remain boundary-local for cli-shell app composition

Raw PTY transport SHALL remain lawful at terminal boundaries that understand terminal control bytes, but cli-shell app composition SHALL NOT treat raw bytes as the final app truth when terminal-2 composed screen truth is required.

#### Scenario: Terminal-1 uses raw PTY transport
- **WHEN** terminal-1 runs the shell process
- **THEN** terminal-1 SHALL receive raw PTY output bytes from the shell
- **AND** those bytes SHALL feed the backend terminal interpretation path that produces shell screen truth

#### Scenario: Terminal-2 raw output is an adapter
- **WHEN** terminal-2 final app screen must be rendered by a raw-capable host
- **THEN** terminal-2 MAY encode the final app screen into raw output
- **AND** that raw output SHALL be an adapter from terminal-2 screen truth rather than terminal-2's source of truth

#### Scenario: Web mode does not bypass terminal-2 through terminal-1 raw bytes
- **WHEN** `cli-shell --web` renders the app surface
- **THEN** it SHALL consume terminal-2 final app output
- **AND** it SHALL NOT directly stream terminal-1 raw PTY bytes as the official Web app surface

### Requirement: Cli-shell transport SHALL support native stdout and Web transport as equivalent terminal-2 adapters

Cli-shell SHALL support native stdout and Web browser transport as equivalent adapters over terminal-2 final app screen.

#### Scenario: Native adapter writes current process output
- **WHEN** cli-shell runs in native mode
- **THEN** it SHALL render terminal-2 through the current process output path connected to the owning terminal program
- **AND** it SHALL NOT require a separate terminal-2 child PTY just to pipe final app bytes back into the same host

#### Scenario: Web adapter streams terminal-2 app output
- **WHEN** cli-shell runs in `--web` mode
- **THEN** it SHALL stream terminal-2 app output to the browser terminal renderer
- **AND** the browser SHALL observe the same final app surface as native mode

#### Scenario: Transport adapter does not own app state
- **WHEN** either native stdout or Web transport emits terminal-2 output
- **THEN** the adapter SHALL NOT own shell selection, dialogue selection, scrollbar state, focus state, or app chrome truth
- **AND** those states SHALL remain owned by terminal-1 shell offscreen renderer, terminal-chat, or terminal-2 composition as appropriate

### Requirement: Screen-frame transport SHALL keep row-cache optimization inside the codec layer

Screen-frame transport SHALL be allowed to reduce local full-frame transfer and parse cost by encoding visible viewport rows through a per-connection row-cache patch. This optimization SHALL NOT change the backend viewport authority, frontend input forwarding law, or frontend paint path.

By default, local screen-frame delivery SHOULD use row-cache patches rather than CPU-heavy row/scroll diff search. Explicit full-frame and diff modes MAY remain available for debugging or low-bandwidth transport choices.

#### Scenario: Row-cache patch reuses known rows
- **GIVEN** a WebSocket attachment has already received a viewport row with a codec id
- **WHEN** the backend sends a later row-cache patch containing the same serialized row
- **THEN** the patch MAY send only the row codec id for that row
- **AND** the client SHALL decode that row from its per-connection cache
- **AND** the final decoded frame SHALL match the backend viewport cells

#### Scenario: Empty rows use fixed codec id zero
- **WHEN** a row-cache patch contains an empty unstyled row
- **THEN** the transport codec SHALL encode it with `cid=0`
- **AND** the client SHALL decode it without requiring row content payload

#### Scenario: Row-cache is not app-layer duplicate suppression
- **WHEN** the backend prepares a pulled frame
- **THEN** any row reuse, not-modified marker, or duplicate-frame optimization SHALL happen after row serialization in the transport codec layer
- **AND** app, viewport, and frontend rendering code SHALL NOT skip work by comparing business-level visible frame objects before serialization
