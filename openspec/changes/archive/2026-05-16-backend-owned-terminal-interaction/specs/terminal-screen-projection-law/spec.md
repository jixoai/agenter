## MODIFIED Requirements

### Requirement: Host events SHALL route to the region backend that owns interaction truth

Host keyboard, mouse, wheel, drag, resize, and copy events SHALL route through terminal-2 hit-testing to the backend or offscreen renderer that owns the targeted interaction truth. Projection hosts MAY classify the event and map coordinates, but selection, copy, scroll, cursor, wrapping, and semantic-selection truth SHALL belong to the owning backend or offscreen renderer.

#### Scenario: Shell event routes to shell owner
- **WHEN** a host event targets the shell region
- **THEN** terminal-2 SHALL route the event to the shell offscreen renderer or terminal-1 interaction path
- **AND** terminal-chat SHALL NOT observe that event as dialogue input

#### Scenario: Dialogue event routes to terminal-chat owner
- **WHEN** a host event targets the dialogue region
- **THEN** terminal-2 SHALL route the event to terminal-chat OpenTUI backend or dialogue backend interaction owner
- **AND** shell selection, shell scroll, and shell cursor truth SHALL NOT change from that dialogue event

#### Scenario: Final visible result returns through terminal-2
- **WHEN** an owning backend updates state after a routed event
- **THEN** terminal-2 SHALL compose and publish the next final app screen
- **AND** native and Web hosts SHALL observe the result from terminal-2 rather than applying independent host-local paint fixes

#### Scenario: Projection does not retain selected text as owner truth
- **WHEN** a host event changes selection state
- **THEN** the projection host SHALL wait for backend interaction truth or backend overlay publication to render the new selection
- **AND** it SHALL NOT keep host-local selected text as the durable copy source

### Requirement: Offscreen frame projection SHALL route semantic selection gestures to backend owners

The offscreen frame projection component SHALL route terminal-like semantic selection gestures for projected cells to the backend interaction owner. Double-click SHALL request word selection, and triple-click SHALL request row selection. The projection layer MAY classify valid click clusters, but it SHALL NOT compute the selected word, selected row, selected text, or selection overlay as terminal truth.

#### Scenario: Double click requests backend word selection
- **WHEN** the user double-clicks a word-like segment inside a projected terminal region
- **THEN** the offscreen frame projection SHALL route a backend word-selection request to the active owner
- **AND** the backend interaction owner SHALL compute and publish the selected range or overlay
- **AND** the projection host SHALL NOT split words by ASCII whitespace as durable selection truth

#### Scenario: Triple click requests backend row selection
- **WHEN** the user triple-clicks a row inside a projected terminal region
- **THEN** the offscreen frame projection SHALL route a backend row-selection request to the active owner
- **AND** the backend interaction owner SHALL compute and publish the selected row range
- **AND** the selected range SHALL remain bounded to the active owner region

#### Scenario: Semantic selection uses backend copy path
- **WHEN** a word or row is selected by double-click or triple-click
- **THEN** copy extraction SHALL return text through the same backend-selected-text path as drag selection
- **AND** app code SHALL NOT implement a separate copy algorithm for semantic selections

#### Scenario: Click drift resets semantic gesture cluster
- **WHEN** repeated clicks differ by more than one terminal cell in x or cross to another backend row
- **THEN** the offscreen frame projection SHALL reset the semantic click cluster
- **AND** it SHALL NOT send a double-click or triple-click selection request for that cluster

### Requirement: Offscreen terminal input SHALL request backend cursor follow

When shell input is sent through an offscreen terminal projection, the projection layer SHALL request the backend viewport to follow the backend cursor instead of changing local viewport state.

#### Scenario: Keyboard input follows the cursor
- **WHEN** the user has scrolled away from the cursor and sends shell keyboard input
- **THEN** the input path SHALL send the encoded terminal input bytes to the backend
- **AND** it SHALL request the existing backend follow-cursor bridge
- **AND** it SHALL NOT create a local frontend viewport override

#### Scenario: Failed input does not move viewport
- **WHEN** terminal input bytes are not accepted by the backend
- **THEN** the projection layer SHALL NOT request follow-cursor

#### Scenario: Follow cursor result is backend published
- **WHEN** cursor-follow changes the visible viewport
- **THEN** the backend SHALL publish the resulting viewport in terminal truth
- **AND** the projection host SHALL update only from that backend-published viewport

### Requirement: Offscreen terminal word navigation SHALL reuse backend-aware word boundaries

When word-navigation enhancement is enabled, Option+Left and Option+Right SHALL use the same backend-aware word-boundary helper as semantic word selection. A backend that can handle native word movement MAY receive native terminal sequences; a backend interaction adapter MAY compute ICU-based boundaries, but the projection host SHALL NOT keep a separate word-navigation text model.

#### Scenario: Option Left navigates to previous word boundary
- **WHEN** word-navigation enhancement is enabled and the user presses Option+Left in the shell region
- **THEN** cli-shell SHALL route the navigation request through the backend interaction or terminal input path
- **AND** the backend-aware word-boundary helper SHALL determine the movement semantics when native terminal input is insufficient
- **AND** cli-shell SHALL request backend cursor follow after successful input or movement

#### Scenario: Option Right navigates to next word boundary
- **WHEN** word-navigation enhancement is enabled and the user presses Option+Right in the shell region
- **THEN** cli-shell SHALL route the navigation request through the backend interaction or terminal input path
- **AND** the backend-aware word-boundary helper SHALL determine the movement semantics when native terminal input is insufficient
- **AND** cli-shell SHALL request backend cursor follow after successful input or movement

#### Scenario: Option Up and Option Down stay backend native
- **WHEN** the user presses Option+Up or Option+Down
- **THEN** cli-shell SHALL NOT invent app-specific word navigation semantics
- **AND** it SHALL pass through backend/native terminal input when a native sequence is available
