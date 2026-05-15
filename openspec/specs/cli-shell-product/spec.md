# cli-shell-product Specification

## Purpose
Define the ordinary-user `@agenter/cli-shell` product that binds one user shell-terminal host, one shell-truth terminal (`terminal-1`), one final visible product terminal (`terminal-2`), one room, and one AvatarRuntime through product-extension runtime law.

## Requirements

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

### Requirement: Cli-shell SHALL ensure durable terminal resources by session key

Cli-shell SHALL list before creating its session terminal resources because terminal creation is not idempotent. The resolved product shell session key, such as `shell-1`, SHALL be the durable product key from which cli-shell derives both terminal-1 shell truth and terminal-2 final visible product-terminal truth for that session.

#### Scenario: Existing session terminal resources are reused
- **GIVEN** the session terminal resources derived from `shell-1` already exist
- **WHEN** cli-shell starts for `--session=1`
- **THEN** it reuses the existing terminal-1 and terminal-2 resources for that session
- **AND** it does not call terminal create again for already-existing resources

#### Scenario: Missing session terminal resources are created
- **GIVEN** the session terminal resources derived from `shell-2` do not exist
- **WHEN** cli-shell starts for `--session=2`
- **THEN** it creates terminal-1 shell truth and terminal-2 final visible product terminal for that session through the backend terminal control plane
- **AND** the created resources remain visible to backend terminal truth

#### Scenario: Session key derives distinct terminal binding identities
- **WHEN** a user runs `agenter shell --session=1`
- **THEN** cli-shell keeps `shell-1` as the durable product session key
- **AND** it derives a distinct binding identity for terminal-1 from that session key
- **AND** it derives a distinct binding identity for terminal-2 from that session key
- **AND** repeated launches with the same session key resolve those same two terminal bindings instead of collapsing back to one terminal resource

#### Scenario: Terminal access is ensured for the summoned Avatar
- **WHEN** cli-shell attaches session `shell-1` while Avatar `shell-assistant` is selected by default
- **THEN** the Avatar principal has sufficient access to observe and participate through the backend systems required by that product session
- **AND** focus, grants, or equivalent terminal-role bindings are applied through the owning systems instead of local product memory

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

### Requirement: Cli-shell SHALL bind one shell-terminal host to one cli-shell product session

Cli-shell SHALL treat the user-launched shell-terminal as one native host attachment surface for one cli-shell product session. That product session includes terminal-1 as shell truth and terminal-2 as the final visible product terminal. Cli-shell SHALL NOT provide in-product management or switching across multiple product sessions in one shell-terminal.

#### Scenario: One shell-terminal attaches one product session
- **WHEN** a user runs `agenter shell --session=1`
- **THEN** that shell-terminal attaches to product session `shell-1`
- **AND** `shell-terminal-view` renders the visible product terminal for that session
- **AND** cli-shell keeps the matching shell-truth terminal internal to that same product session
- **AND** cli-shell does not create a second visible terminal slot inside the same shell-terminal

#### Scenario: Another product session requires another shell-terminal launch
- **WHEN** a user wants to work with `shell-2`
- **THEN** they run `agenter shell --session=2` from another shell-terminal
- **AND** the first shell-terminal remains attached only to product session `shell-1`

#### Scenario: Existing global terminal catalog remains backend truth
- **WHEN** cli-shell attaches to `shell-1`
- **THEN** it may read backend terminal facts for the bound shell-truth and visible product-terminal resources
- **AND** it does not materialize a local multi-terminal catalog as a navigation surface

### Requirement: Cli-shell SHALL preserve two backend terminal roles under one product law

Cli-shell SHALL preserve one shell-truth terminal (`terminal-1`) and one final visible product terminal (`terminal-2`) under one product/bootstrap law. Terminal-1 remains the only shell truth for PTY interaction, shell buffer, shell scrollback, shell cursor, shell viewport, durable shell commit source, and LoopBus shell observation source. Terminal-2 remains the authoritative visible product-terminal surface consumed by native and Web hosts.

#### Scenario: Default launch binds both terminal roles
- **WHEN** a user runs `agenter shell`
- **THEN** cli-shell ensures one shell-truth terminal and one visible product terminal for that shell session
- **AND** both terminal roles remain part of one product bootstrap rather than two independent products

#### Scenario: Product surfaces bind terminal-2 while shell authority remains on terminal-1
- **WHEN** cli-shell completes bootstrap for `shell-1`
- **THEN** native `shell-terminal-view` binds the visible shell body to terminal-2
- **AND** `agenter shell --web` binds `web-terminal-view` to terminal-2 for that same product session
- **AND** shell PTY authority, durable shell commit truth, and LoopBus shell observation truth remain attached to terminal-1

#### Scenario: Native host consumes terminal-2 while terminal-1 remains shell truth
- **WHEN** cli-shell renders in native host mode
- **THEN** `shell-terminal-view` projects terminal-2 back to the owning shell host
- **AND** native protocol-2 composition keeps terminal-1 and terminal-2 responsibilities distinct

#### Scenario: Focus or host changes do not collapse terminal roles
- **WHEN** runtime focus changes or another host attaches to the same cli-shell product session
- **THEN** terminal-1 and terminal-2 responsibilities remain distinct
- **AND** the product does not bypass terminal-2 or silently swap shell truth

#### Scenario: Session key remains the product identity while the two terminal roles stay distinct
- **WHEN** a user launches `agenter shell --session=1`
- **THEN** cli-shell treats `shell-1` as the durable product session key
- **AND** terminal-1 and terminal-2 remain distinct backend roles within that same product session
- **AND** the session key does not collapse the two terminal roles into one identity

#### Scenario: Visible product-terminal identity remains backend truth
- **WHEN** a host renders the visible shell surface for `shell-1`
- **THEN** it consumes terminal-2 as the visible product-terminal truth for that session
- **AND** it does not reinterpret that visible surface as terminal-1 shell truth

### Requirement: Cli-shell TUI SHALL intrude only at the bottom of the shell-terminal

Cli-shell SHALL render a terminal-first TUI whose first screen uses the shell-terminal primarily as an ordinary usable terminal surface. In the collapsed default state, the product UI SHALL intrude only as a one-row bottom toolbar and SHALL match the current v8 toolbar effect reference.

#### Scenario: First screen shows one active terminal with one-line bottom toolbar
- **WHEN** cli-shell renders after orchestration succeeds
- **THEN** the main body renders ordinary terminal content for the active visible product terminal
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
- **WHEN** cli-shell renders the dialogue panel in right or left placement
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

### Requirement: Cli-shell SHALL compose `shell-terminal-view` as its primary shell surface

Cli-shell SHALL render a shell-first product whose primary visible surface is `shell-terminal-view` bound to terminal-2. Terminal-1 remains the only shell truth, and backend-owned protocol-2 composition projects terminal-1 plus accepted product chrome into terminal-2. In the collapsed default state, the product UI SHALL intrude only as a one-row bottom extension.

#### Scenario: First screen shows one active shell-terminal-view with one-line bottom extension
- **WHEN** cli-shell renders after orchestration succeeds
- **THEN** the main body renders ordinary shell content for terminal-2 through `shell-terminal-view`
- **AND** Agenter product chrome is confined to one bottom row
- **AND** no top status line, header, route tabs, dashboard frame, left rail, shell list, session list, tab strip, or terminal switcher is rendered
- **AND** the bottom row does not replace shell ownership of terminal scrolling, cursor, or input semantics

#### Scenario: Bottom extension remains orthogonal to shell ownership
- **WHEN** cli-shell renders product metadata or extension actions
- **THEN** the bottom row projects extension state without becoming the terminal viewport owner
- **AND** shell scrolling, shell cursor state, and shell lifecycle truth still come from the backend terminal

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
- **AND** the visible shell surface remains the single active product-terminal surface

#### Scenario: Dialogue panel toolbar exposes placement and close actions
- **WHEN** the dialogue panel is open
- **THEN** its top toolbar renders placement buttons for left, right, and floating
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

### Requirement: Cli-shell SHALL provide explicit transcript chrome only as optional extension chrome

Cli-shell MAY provide explicit transcript chrome for the product room, but that transcript chrome SHALL remain optional extension chrome separate from shell ownership. It SHALL read durable room truth, SHALL NOT create another terminal truth, and SHALL NOT reuse the one-line bottom extension as a transcript pane.

#### Scenario: Optional transcript chrome opens without replacing the shell
- **WHEN** the user invokes the configured transcript-open gesture
- **THEN** cli-shell may render the product room conversation in explicit side or floating transcript chrome
- **AND** the visible shell surface remains the single active product-terminal surface
- **AND** the one-line bottom extension does not expand into a second transcript panel

#### Scenario: Transcript chrome reads durable room truth
- **WHEN** transcript chrome is open for `shell-1`
- **THEN** it renders messages from the durable product room for `shell-1`
- **AND** it does not keep a separate local transcript as authoritative truth

#### Scenario: Transcript chrome closes back to the one-line shell-first default
- **WHEN** transcript chrome is open
- **AND** the user closes or cancels it
- **THEN** cli-shell returns to the one-line bottom extension default
- **AND** terminal input ownership returns to shell mode

### Requirement: Cli-shell dialogue panel SHALL support smart placement

Cli-shell SHALL support left, right, and floating dialogue panel placement. Initial placement and resize handling SHALL use deterministic smart placement based on available shell-terminal space and minimum viable thresholds.

#### Scenario: First open uses smart placement
- **WHEN** the user opens the dialogue panel for the first time
- **THEN** cli-shell chooses right placement if horizontal space is sufficient
- **AND** chooses floating placement as fallback when side placement is not viable

#### Scenario: Resize may trigger smart re-placement
- **WHEN** the shell-terminal is resized and the current placement falls below its minimum viable space threshold
- **THEN** cli-shell reruns smart placement
- **AND** it keeps the panel usable without creating a second terminal surface

#### Scenario: Resize may switch between side and floating transcript chrome
- **WHEN** the shell-terminal is resized and the current transcript placement falls below its minimum viable threshold
- **THEN** cli-shell may switch between side and floating transcript chrome
- **AND** it does not convert bottom into a multi-row transcript placement

### Requirement: Cli-shell SHALL keep terminal input as the default input owner

Cli-shell SHALL forward shell-terminal input to the current shell session terminal path by default. The bottom Agenter composer SHALL receive input only after an explicit product focus gesture.

#### Scenario: Printable input goes to the terminal by default
- **WHEN** cli-shell is in terminal mode and the user types printable characters
- **THEN** cli-shell forwards those characters to the current shell session terminal path
- **AND** the bottom Agenter composer does not receive or buffer them

#### Scenario: Terminal control keys remain terminal-owned by default
- **WHEN** cli-shell is in terminal mode and the user presses `Ctrl+C`
- **THEN** cli-shell forwards the interrupt to the current shell session terminal path
- **AND** cli-shell does not exit because of that keypress

#### Scenario: Explicit composer focus sends room message
- **WHEN** the user enters the Agenter composer through the configured focus gesture
- **AND** types a message and presses `Enter`
- **THEN** cli-shell sends that message to the product room
- **AND** it does not send the message text to the current shell session terminal path
- **AND** focus returns to terminal mode after sending

#### Scenario: Composer cancel returns to terminal mode
- **WHEN** the bottom Agenter composer is focused
- **AND** the user presses `Escape`
- **THEN** cli-shell discards the composer draft
- **AND** focus returns to terminal mode

#### Scenario: Explicit extension actions do not leak into terminal input bytes
- **WHEN** the user triggers a configured bottom-extension action through click or shortcut
- **THEN** cli-shell routes that activation to the product extension action path
- **AND** `shell-terminal-view` does not emit that activation as shell input bytes to the backend terminal

### Requirement: Cli-shell shell input SHALL return scrolled shell viewport to cursor

Cli-shell SHALL return the shell viewport to the cursor position when shell input is sent while the user has scrolled away from the cursor.

#### Scenario: Typing while scrolled follows the cursor
- **WHEN** the shell viewport is scrolled away from the cursor
- **AND** the user types shell input
- **THEN** cli-shell SHALL send terminal input to terminal-1
- **AND** cli-shell SHALL request the backend viewport to target the cursor row
- **AND** the visible shell result SHALL return through terminal-2 frame synchronization

#### Scenario: Dialogue typing does not move shell viewport
- **WHEN** dialogue input is focused
- **AND** the user types dialogue text
- **THEN** cli-shell SHALL update dialogue input state
- **AND** it SHALL NOT request shell follow-cursor

### Requirement: Cli-shell terminal selection SHALL support word and row gestures

Cli-shell SHALL support terminal-like word and row selection gestures in projected shell and dialogue regions.

#### Scenario: Double click selects one word
- **WHEN** the user double-clicks a word-like segment inside shell or dialogue projected text
- **THEN** cli-shell SHALL select that word using the offscreen frame projection's segmented-word selection
- **AND** copy SHALL return the selected word

#### Scenario: Triple click selects one row
- **WHEN** the user triple-clicks inside shell or dialogue projected text
- **THEN** cli-shell SHALL select the clicked row inside that region
- **AND** copy SHALL return that row text without neighboring product chrome

#### Scenario: Word and row selection stay inside owner region
- **WHEN** semantic selection starts in shell or dialogue
- **THEN** the selection SHALL remain inside that owner region
- **AND** it SHALL NOT include scrollbar, status toolbar, or the other region's text

### Requirement: Cli-shell shell scrollbar SHALL show backend progress

Cli-shell SHALL show a visible shell scrollbar thumb/progress that reflects backend viewport state.

#### Scenario: Scrollbar progress changes after backend scroll
- **WHEN** backend shell viewport state changes from top to a later scroll position
- **THEN** cli-shell SHALL render a visibly different scrollbar progress position
- **AND** the visual state SHALL come from shell offscreen renderer backend state

#### Scenario: Scrollbar click and drag stay backend-driven
- **WHEN** the user clicks or drags the shell scrollbar
- **THEN** cli-shell SHALL send backend viewport target requests
- **AND** it SHALL NOT locally commit scrollbar progress before backend state returns

### Requirement: Cli-shell SHALL derive backend terminal geometry from shell-terminal geometry

Cli-shell SHALL reserve the collapsed one-row toolbar and SHALL configure the backend terminal with the remaining visible geometry. The opened dialogue panel is a view state over the terminal surface and SHALL NOT create another terminal or terminal navigation model.

#### Scenario: Initial terminal geometry subtracts collapsed toolbar row
- **GIVEN** the shell-terminal is 120 columns by 40 rows
- **WHEN** cli-shell renders with a one-row collapsed toolbar
- **THEN** it configures the visible product terminal for that shell session with 120 columns and 39 rows
- **AND** it renders collapsed Agenter UI only in the bottom row

#### Scenario: Resize updates backend terminal config
- **WHEN** the shell-terminal is resized
- **THEN** cli-shell recomputes terminal rows after subtracting the bottom layer
- **AND** it updates the backend terminal cols/rows through the global terminal config path

#### Scenario: Dialogue panel open does not rename or multiply geometry owners
- **WHEN** the dialogue panel opens
- **THEN** cli-shell keeps shell-terminal geometry ownership local to the current shell-terminal
- **AND** it does not create another terminal surface or terminal navigation model

#### Scenario: Web attachments do not silently replace cli-shell geometry authority
- **GIVEN** cli-shell already owns geometry for `shell-1` through `shell-terminal-view`
- **WHEN** another `web-terminal-view` attachment changes local panel size
- **THEN** that Web host adapts presentation locally
- **AND** backend terminal cols and rows remain derived from `shell-terminal-view` and the native shell window until authority changes explicitly

### Requirement: Cli-shell SHALL expose active terminal observation as product startup truth

Cli-shell SHALL treat visible Avatar startup as active shell-truth observation readiness. The product-visible startup state MUST indicate when terminal-1 changes can wake LoopBus and participate in assistant understanding, rather than relying only on local heartbeat wording or process bootstrap assumptions.

#### Scenario: LoopBus-ready observation counts as Avatar started
- **WHEN** cli-shell has attached terminal-1 and its terminal semantic changes can wake LoopBus observation flow
- **THEN** the product may present the Avatar as started or ready
- **AND** that readiness is based on terminal observation truth rather than on a local-only toolbar string

#### Scenario: Runtime bootstrap without terminal observation is not sufficient startup evidence
- **WHEN** runtime processes have auto-started but terminal observation is not yet active
- **THEN** cli-shell does not present full Avatar-started readiness
- **AND** the product does not treat a heartbeat placeholder alone as sufficient evidence

### Requirement: Cli-shell SHALL detach without deleting durable backend resources

Cli-shell process exit SHALL detach the shell-terminal host from product backend resources. It SHALL NOT delete the shell-session terminal resources or product room by default.

#### Scenario: Product process exits without deleting terminal or room
- **GIVEN** cli-shell is attached to shell session `shell-1` with terminal-1, terminal-2, and a product room
- **WHEN** the cli-shell process exits
- **THEN** the durable terminal resources for shell session `shell-1` remain available to backend truth
- **AND** the product room remains reusable by metadata

#### Scenario: Repeated launch reconnects after detach
- **GIVEN** a previous cli-shell process detached from `shell-1`
- **WHEN** the user runs `agenter shell` again
- **THEN** cli-shell reattaches to the existing shell session terminal resources for `shell-1`
- **AND** it reuses the existing product room for `shell-1`

#### Scenario: Internal terminal process stop is visible but not destructive
- **WHEN** one backend terminal resource for shell session `shell-1` stops
- **THEN** cli-shell shows the stopped state in the bottom layer
- **AND** it preserves the terminal record and room identity for reconnect or restart behavior
