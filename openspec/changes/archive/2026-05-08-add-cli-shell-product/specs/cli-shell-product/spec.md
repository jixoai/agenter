## ADDED Requirements

### Requirement: Cli-shell SHALL parse optional Avatar mention and product terminal name separately

The `@agenter/cli-shell` product SHALL parse an optional Avatar mention and a product-local shell session name, and it SHALL map the session name only to a terminal name. When no Avatar mention is present, cli-shell SHALL use the dedicated terminal assistant Avatar `shell-assistant`. Explicit mentions such as `@default` SHALL remain supported overrides.

#### Scenario: Default command attaches shell-assistant to shell-1
- **WHEN** a user runs `agenter shell`
- **THEN** cli-shell resolves the Avatar nickname as `shell-assistant`
- **AND** it resolves the product terminal name as `shell-1`

#### Scenario: Missing shell-assistant Avatar is ensured
- **GIVEN** no Avatar with nickname `shell-assistant` exists
- **WHEN** a user runs `agenter shell`
- **THEN** cli-shell ensures or creates the Avatar through generic Avatar/product-extension APIs
- **AND** core launcher modules do not special-case that Avatar identity

#### Scenario: Explicit Avatar mention overrides shell-assistant default
- **WHEN** a user runs `agenter shell @default`
- **THEN** cli-shell summons Avatar `default`
- **AND** it does not replace the explicit mention with `shell-assistant`

#### Scenario: Historical terminal assistant role does not override Avatar mention
- **WHEN** a user runs `agenter shell @default`
- **THEN** cli-shell summons Avatar `default`
- **AND** historical terminal-assistant role notes do not override the explicit Avatar mention

#### Scenario: Numeric session maps to product terminal name
- **WHEN** a user runs `agenter shell --session=2`
- **THEN** cli-shell resolves the product terminal name as `shell-2`
- **AND** it does not treat `2` as an AvatarRuntime session id

#### Scenario: Named session maps to product terminal name
- **WHEN** a user runs `agenter shell --session=prod`
- **THEN** cli-shell resolves the product terminal name as `shell-prod`
- **AND** repeated launches with the same arguments target the same terminal name

### Requirement: Cli-shell SHALL default to superadmin product login

Cli-shell SHALL authenticate through the local daemon using superadmin auto-login by default before it mutates room, terminal, or AvatarRuntime resources.

#### Scenario: Superadmin auto-login succeeds before orchestration
- **WHEN** cli-shell starts against a local daemon
- **THEN** it requests auto-login and stores the returned auth token in its client
- **AND** later room and terminal mutations use authenticated backend APIs

#### Scenario: Product login failure blocks mutation
- **WHEN** superadmin auto-login fails
- **THEN** cli-shell exits with an explicit authentication error
- **AND** it does not create or mutate terminals, rooms, or AvatarRuntime state

### Requirement: Cli-shell SHALL summon the selected Avatar without multiplying runtime identity

Cli-shell SHALL ensure the selected AvatarRuntime is running for the selected Avatar, and it SHALL attach product resources to that runtime instead of creating product-session-specific runtime identities.

#### Scenario: Repeated default launch reuses one AvatarRuntime
- **WHEN** a user runs `agenter shell` multiple times
- **THEN** cli-shell reuses the existing AvatarRuntime for Avatar `shell-assistant`
- **AND** it does not create another runtime because `shell-1` already exists

#### Scenario: Different shell names share the AvatarRuntime
- **WHEN** a user runs `agenter shell --session=1` and `agenter shell --session=2`
- **THEN** both resolved terminal resources attach to the same AvatarRuntime for Avatar `shell-assistant`
- **AND** the different shell names only select different terminal and room resources

### Requirement: Cli-shell SHALL ensure a durable internal terminal by name

Cli-shell SHALL list before creating the target terminal because terminal creation is not idempotent. The target terminal id SHALL be the resolved product terminal name.

#### Scenario: Existing internal terminal is reused
- **GIVEN** global terminal `shell-1` already exists
- **WHEN** cli-shell starts for `--session=1`
- **THEN** it focuses or attaches terminal `shell-1`
- **AND** it does not call terminal create for `shell-1`

#### Scenario: Missing internal terminal is created
- **GIVEN** global terminal `shell-2` does not exist
- **WHEN** cli-shell starts for `--session=2`
- **THEN** it creates terminal `shell-2` through the backend terminal control plane
- **AND** the created terminal is visible in the global terminal catalog

#### Scenario: Terminal grant is ensured for the summoned Avatar
- **WHEN** cli-shell attaches terminal `shell-1` while Avatar `shell-assistant` is selected by default
- **THEN** the Avatar principal has sufficient terminal access to observe and participate through backend systems
- **AND** terminal focus for that Avatar points at `shell-1`

### Requirement: Cli-shell SHALL ensure a durable room for the shell product

Cli-shell SHALL create or reuse a global room for the resolved shell name, using backend-allocated room ids and product metadata rather than using the shell name as the room id.

#### Scenario: Existing product room is reused by metadata
- **GIVEN** a global room exists with metadata `product = cli-shell` and `shellName = shell-1`
- **WHEN** cli-shell starts for `--session=1`
- **THEN** it reuses that room
- **AND** it does not create a duplicate room with the same product identity

#### Scenario: Missing product room is created with backend id
- **GIVEN** no global room has cli-shell metadata for `shell-1`
- **WHEN** cli-shell starts for `--session=1`
- **THEN** it creates a global room whose visible title may be `shell-1`
- **AND** the durable room id is allocated by the backend message authority

#### Scenario: Avatar is granted and focused into the product room
- **WHEN** cli-shell ensures the room for `shell-1`
- **THEN** the selected Avatar principal has room access
- **AND** the room is focused for that Avatar as part of the summon flow

### Requirement: Cli-shell SHALL bind one shell-terminal to one internal terminal

Cli-shell SHALL treat the user-launched shell-terminal as a single attachment surface for one internal `terminalSystem` terminal. It SHALL NOT provide in-product management or switching across multiple internal terminals in one shell-terminal.

#### Scenario: One shell-terminal attaches one terminal
- **WHEN** a user runs `agenter shell --session=1`
- **THEN** that shell-terminal attaches to internal terminal `shell-1`
- **AND** cli-shell does not create a second visible terminal slot inside the same shell-terminal

#### Scenario: Another terminal requires another shell-terminal launch
- **WHEN** a user wants to work with `shell-2`
- **THEN** they run `agenter shell --session=2` from another shell-terminal
- **AND** the first shell-terminal remains attached only to `shell-1`

#### Scenario: Existing global terminal catalog remains backend truth
- **WHEN** cli-shell attaches to `shell-1`
- **THEN** it may read backend terminal facts for status and hydration
- **AND** it does not materialize a local multi-terminal catalog as a navigation surface

### Requirement: Cli-shell TUI SHALL intrude only at the bottom of the shell-terminal

Cli-shell SHALL render a terminal-first TUI whose first screen uses the shell-terminal primarily as an ordinary usable terminal surface. In the collapsed default state, the product UI SHALL intrude only as a one-row bottom toolbar and SHALL match the current v8 toolbar effect reference.

#### Scenario: First screen shows one active terminal with one-line bottom toolbar
- **WHEN** cli-shell renders after orchestration succeeds
- **THEN** the main body renders ordinary terminal content for the active internal terminal
- **AND** Agenter status and controls are confined to one bottom toolbar row
- **AND** no top status line, header, route tabs, dashboard frame, left rail, shell list, session list, tab strip, or terminal switcher is rendered
- **AND** no persistent right-side room transcript pane is rendered

#### Scenario: Toolbar uses the required three-zone structure
- **WHEN** cli-shell renders product metadata
- **THEN** the bottom toolbar includes a status icon zone
- **AND** it includes a current Heartbeat zone
- **AND** it includes an action button zone
- **AND** the toolbar is visually distinguished primarily by background color

#### Scenario: Product UI is rendered as terminal cells
- **WHEN** cli-shell renders toolbar, dialogue, borders, gutters, scrollbar, controls, backgrounds, or highlights
- **THEN** every visible product element maps to shell-terminal character cells
- **AND** borders are rendered through box-drawing or ASCII characters rather than pixel-only card edges
- **AND** backgrounds and highlights are applied as cell ranges
- **AND** wide emoji and CJK glyphs are measured with terminal-width semantics before layout is finalized

#### Scenario: Docked dialogue panels use separators instead of enclosing borders
- **WHEN** cli-shell renders the dialogue panel in right, left, or bottom placement
- **THEN** it separates terminal content from dialogue content with a single split line in the placement direction
- **AND** it separates dialogue toolbar, message list, and input regions with internal split lines
- **AND** it does not draw a complete outer rectangle around the docked dialogue panel
- **AND** floating placement may use a minimal outline only because it overlaps terminal content

#### Scenario: Toolbar does not become a backend status dashboard
- **WHEN** cli-shell renders the default toolbar
- **THEN** it does not enumerate `terminal`, `room`, `superadmin`, `connected`, package source, or daemon status tags as independent dock chips
- **AND** backend facts appear only when projected by the current Heartbeat or diagnostics

#### Scenario: Optional separator is not a required content row
- **WHEN** cli-shell theme renders a separator between terminal body and bottom dock
- **THEN** the separator is purely visual
- **AND** the default product content still fits in one bottom row

#### Scenario: UI terminology distinguishes shell-terminal and terminal
- **WHEN** cli-shell renders labels or diagnostics
- **THEN** it uses `shell-terminal` for the user-launched terminal process when disambiguation is needed
- **AND** it uses `terminal` for the internal Agenter `terminalSystem` instance
- **AND** it does not use `SHELLS` or `SESSIONS` as a navigation label

#### Scenario: Current effect reference is tracked in the change
- **WHEN** reviewers inspect the change design
- **THEN** `assets/cli-shell-product-reference-v8-toolbar-grid.png` is available as the accepted collapsed toolbar product-effect reference
- **AND** `assets/cli-shell-product-reference-v8-toolbar-grid.svg` is available as its deterministic vector companion
- **AND** `assets/cli-shell-product-reference-v8-toolbar-grid.txt` is available as its terminal-grid auxiliary contract
- **AND** `assets/cli-shell-product-reference-v8-dialogue-right-grid.png` is available as the accepted dialogue-open product-effect reference
- **AND** `assets/cli-shell-product-reference-v8-dialogue-right-grid.svg` is available as its deterministic vector companion
- **AND** `assets/cli-shell-product-reference-v8-dialogue-right-grid.txt` is available as its terminal-grid auxiliary contract
- **AND** stale v1-v7 exploration images are not retained as final-review assets
- **AND** the implementation target can be revised only by replacing the whole accepted PNG/SVG/TXT reference set in later feedback rounds

### Requirement: Cli-shell toolbar SHALL expose status, current Heartbeat, and actions

Cli-shell's one-line toolbar SHALL expose assistant state through a status icon, the current Heartbeat last message-part, and exactly the v1 action set: managed/takeover toggle plus chat entry.

#### Scenario: Status icon reflects assistant activity
- **WHEN** assistant activity is idle, text-progressing, thinking, tool-calling, message-operating, or terminal-operating
- **THEN** cli-shell renders a compact status icon for that state
- **AND** the icon may use emoji for fast terminal scanning

#### Scenario: Heartbeat streams the latest message-part
- **WHEN** the current Heartbeat emits message-parts
- **THEN** cli-shell renders the latest displayable message-part in the toolbar Heartbeat zone
- **AND** it updates that zone in place as streaming output arrives

#### Scenario: Built-in tool calls get optimized toolbar summaries
- **WHEN** the current Heartbeat is operating message, terminal, or attention built-in tools
- **THEN** cli-shell renders a compact operation summary instead of raw tool payload
- **AND** raw tool truth remains available through backend event/message/terminal systems

#### Scenario: Toolbar action buttons expose managed mode and chat
- **WHEN** cli-shell renders toolbar actions
- **THEN** it renders a managed/takeover toggle button
- **AND** it renders a chat entry button with unread count
- **AND** the chat entry supports a keyboard shortcut and mouse activation

### Requirement: Cli-shell managed mode SHALL consume hosting attention and product delegation contracts

Cli-shell SHALL implement its managed/takeover toggle as a view and control over platform-hosted facts: a product-scoped hosting AttentionItem for scheduling and a generic product delegation lease for autonomous terminal write authority when allowed. It SHALL NOT store managed mode as local-only toolbar truth, and it SHALL NOT ask core modules for cli-shell-specific takeover behavior.

#### Scenario: Managed on creates hosting attention
- **WHEN** the user turns managed/takeover on from the cli-shell toolbar
- **THEN** cli-shell commits a product-scoped AttentionItem for the selected Avatar with `scores: {"hosting": 1000}`
- **AND** the item body names `productId=cli-shell`, the current shell name, the bound terminal, the bound room, the granting user, and the current objective if known
- **AND** hosting attention is represented as platform truth rather than local toolbar state

#### Scenario: Managed on creates product delegation for terminal write autonomy
- **WHEN** the user turns managed/takeover on from the cli-shell toolbar
- **THEN** cli-shell requests a product delegation for `productId=cli-shell`, the current shell name, the bound terminal, the bound room, and the summoned Avatar
- **AND** the default managed policy is write-capable terminal autonomy
- **AND** the delegation is represented as platform truth with expiry and policy
- **AND** terminal write authority is granted through terminal-native lease or approval law rather than through a cli-shell bypass

#### Scenario: Managed off revokes product delegation
- **WHEN** the user turns managed/takeover off from the cli-shell toolbar
- **THEN** cli-shell revokes the active delegation it created
- **AND** it commits a hosting attention update with `scores: {"hosting": 0}` and reason `user_disabled`
- **AND** it stops presenting terminal idle or dirty state as autonomous takeover work
- **AND** it does not revoke unrelated room membership, terminal read access, or user manual terminal input

#### Scenario: Managed state survives cli-shell detach and reconnect
- **GIVEN** cli-shell enabled managed/takeover and then detached
- **WHEN** another cli-shell process reattaches to the same shell name before the delegation expires
- **THEN** it reads managed/takeover state from platform hosting attention and delegation projections
- **AND** it does not infer managed/takeover state from local process memory

#### Scenario: Avatar may settle hosting when work is complete
- **GIVEN** cli-shell managed mode committed `scores: {"hosting": 1000}`
- **WHEN** the selected Avatar determines the hosting objective is complete
- **THEN** the Avatar may commit a hosting update that lowers the `hosting` score to `0`
- **AND** it should preserve the completion state in memory or attention facts before context compaction can erase the working details

#### Scenario: Avatar may keep hosting open for watch tasks
- **GIVEN** cli-shell managed mode committed `scores: {"hosting": 1000}`
- **WHEN** the selected Avatar determines the task is intentionally open-ended, such as watching terminal output and reporting failures to chat
- **THEN** it may keep the `hosting` score positive
- **AND** it should record the watch policy and progress in durable hosting memory

#### Scenario: Autonomous terminal writes are attributable
- **WHEN** the Avatar writes to the bound terminal while managed/takeover is active
- **THEN** the terminal write uses the Avatar actor identity
- **AND** terminal activity includes delegation or lease provenance
- **AND** superadmin product bootstrap authority is not the hidden actor for the write

#### Scenario: Managed off blocks autonomous writes but preserves conversation
- **WHEN** managed/takeover is off
- **THEN** cli-shell still lets the Avatar observe context and answer in the product room
- **AND** the Avatar may request approval or ask the user before terminal mutation
- **AND** cli-shell does not let unresolved attention alone write terminal input without a valid delegation

### Requirement: Cli-shell SHALL provide an explicit TUI dialogue panel

Cli-shell SHALL provide an Agenter dialogue panel for the product room. The panel SHALL be an explicit opened state, not a default pane and not part of the collapsed one-line toolbar.

#### Scenario: Dialogue panel opens on the right side
- **WHEN** the user invokes the configured dialogue-open gesture
- **THEN** cli-shell renders the product room conversation as a right-side dialogue panel
- **AND** the panel contains visible conversation structure such as user messages, Avatar replies, and a message input area
- **AND** the terminal remains the single active internal terminal

#### Scenario: Dialogue panel toolbar exposes placement and close actions
- **WHEN** the dialogue panel is open
- **THEN** its top toolbar renders placement buttons for left, right, floating, and bottom
- **AND** it renders a close button on the right side of that toolbar

#### Scenario: Dialogue panel reads from backend room truth
- **WHEN** the dialogue panel is open for `shell-1`
- **THEN** it renders messages from the durable product room for `shell-1`
- **AND** it does not keep a separate local transcript as authoritative truth

#### Scenario: Dialogue panel closes back to one-line default
- **WHEN** the dialogue panel is open
- **AND** the user closes or cancels it
- **THEN** cli-shell returns to the one-line bottom toolbar
- **AND** terminal input ownership returns to terminal mode

#### Scenario: Dialogue panel is not default chrome
- **WHEN** cli-shell renders the dialogue panel
- **THEN** it is visible only while explicitly opened
- **AND** it does not reduce the product to a dashboard layout

#### Scenario: Dialogue message list renders Markdown with gutters and scrollbar
- **WHEN** the dialogue panel renders messages
- **THEN** the middle region renders terminal Markdown in a scrollable list
- **AND** the left side reserves a gutter column
- **AND** the right side shows a scrollbar
- **AND** user-authored messages use gray background and a `>` marker in the gutter

#### Scenario: Dialogue message list renders short times
- **WHEN** the dialogue panel renders a message group
- **THEN** it displays a short local time token for that message group
- **AND** the short time is a view projection of the durable message timestamp rather than a replacement for message truth

#### Scenario: Dialogue message list separates date changes
- **WHEN** two adjacent visible message groups belong to different local calendar dates
- **THEN** the dialogue list renders an independent centered date divider row before the first message on the new date
- **AND** the date divider is not persisted as a message

#### Scenario: Dialogue input is focused by default
- **WHEN** the dialogue panel opens
- **THEN** the bottom input box is focused by default
- **AND** it has a one-line separator, gray background, left `>` gutter, and visible cursor

### Requirement: Cli-shell dialogue panel SHALL support smart placement

Cli-shell SHALL support left, right, floating, and bottom dialogue panel placement. Initial placement and resize handling SHALL use deterministic smart placement based on available shell-terminal space and minimum viable thresholds.

#### Scenario: First open uses smart placement
- **WHEN** the user opens the dialogue panel for the first time
- **THEN** cli-shell chooses right placement if horizontal space is sufficient
- **AND** chooses bottom placement if vertical space is sufficient and right placement is not viable
- **AND** chooses floating placement as fallback

#### Scenario: Resize may trigger smart re-placement
- **WHEN** the shell-terminal is resized and the current placement falls below its minimum viable space threshold
- **THEN** cli-shell reruns smart placement
- **AND** it keeps the panel usable without creating a second terminal surface

### Requirement: Cli-shell SHALL keep terminal input as the default input owner

Cli-shell SHALL forward shell-terminal input to the attached internal terminal by default. The bottom Agenter composer SHALL receive input only after an explicit product focus gesture.

#### Scenario: Printable input goes to the terminal by default
- **WHEN** cli-shell is in terminal mode and the user types printable characters
- **THEN** cli-shell forwards those characters to internal terminal `shell-1`
- **AND** the bottom Agenter composer does not receive or buffer them

#### Scenario: Terminal control keys remain terminal-owned by default
- **WHEN** cli-shell is in terminal mode and the user presses `Ctrl+C`
- **THEN** cli-shell forwards the interrupt to internal terminal `shell-1`
- **AND** cli-shell does not exit because of that keypress

#### Scenario: Explicit composer focus sends room message
- **WHEN** the user enters the Agenter composer through the configured focus gesture
- **AND** types a message and presses `Enter`
- **THEN** cli-shell sends that message to the product room
- **AND** it does not send the message text to the internal terminal
- **AND** focus returns to terminal mode after sending

#### Scenario: Composer cancel returns to terminal mode
- **WHEN** the bottom Agenter composer is focused
- **AND** the user presses `Escape`
- **THEN** cli-shell discards the composer draft
- **AND** focus returns to terminal mode

### Requirement: Cli-shell SHALL derive backend terminal geometry from shell-terminal geometry

Cli-shell SHALL reserve the collapsed one-row toolbar and SHALL configure the backend terminal with the remaining visible geometry. The opened dialogue panel is a view state over the terminal surface and SHALL NOT create another terminal or terminal navigation model.

#### Scenario: Initial terminal geometry subtracts collapsed toolbar row
- **GIVEN** the shell-terminal is 120 columns by 40 rows
- **WHEN** cli-shell renders with a one-row collapsed toolbar
- **THEN** it configures internal terminal `shell-1` with 120 columns and 39 rows
- **AND** it renders collapsed Agenter UI only in the bottom row

#### Scenario: Resize updates backend terminal config
- **WHEN** the shell-terminal is resized
- **THEN** cli-shell recomputes terminal rows after subtracting the bottom layer
- **AND** it updates the backend terminal cols/rows through the global terminal config path

#### Scenario: Dialogue panel open does not rename or multiply geometry owners
- **WHEN** the dialogue panel opens
- **THEN** cli-shell keeps shell-terminal geometry ownership local to the current shell-terminal
- **AND** it does not create another terminal surface or terminal navigation model

### Requirement: Cli-shell SHALL detach without deleting durable backend resources

Cli-shell process exit SHALL detach the shell-terminal from backend resources. It SHALL NOT delete the internal terminal or product room by default.

#### Scenario: Product process exits without deleting terminal or room
- **GIVEN** cli-shell is attached to internal terminal `shell-1` and a product room for `shell-1`
- **WHEN** the cli-shell process exits
- **THEN** internal terminal `shell-1` remains in the global terminal catalog
- **AND** the product room remains reusable by metadata

#### Scenario: Repeated launch reconnects after detach
- **GIVEN** a previous cli-shell process detached from `shell-1`
- **WHEN** the user runs `agenter shell` again
- **THEN** cli-shell reattaches to existing internal terminal `shell-1`
- **AND** it reuses the existing product room for `shell-1`

#### Scenario: Internal terminal process stop is visible but not destructive
- **WHEN** the backend terminal process for `shell-1` stops
- **THEN** cli-shell shows the stopped state in the bottom layer
- **AND** it preserves the terminal record and room identity for reconnect or restart behavior
