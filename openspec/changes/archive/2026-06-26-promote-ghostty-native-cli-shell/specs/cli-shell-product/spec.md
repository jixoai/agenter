## ADDED Requirements

### Requirement: Cli-shell SHALL carry explicit terminal backend selection as durable launch truth

Cli-shell SHALL accept an optional `--backend=<name>` argument and treat that value as durable terminal launch truth owned by terminal-system. Backend selection SHALL remain independent from browser renderer preference, shell name, and Avatar identity.

#### Scenario: Omitted backend keeps the current default
- **WHEN** a user runs `agenter shell`
- **THEN** cli-shell requests the durable terminal backend `xterm`
- **AND** it does not infer backend identity from renderer preference or shell name

#### Scenario: Explicit ghostty-native backend is requested through cli-shell
- **WHEN** a user runs `agenter shell --backend=ghostty-native`
- **THEN** cli-shell requests the durable terminal backend `ghostty-native`
- **AND** the terminal binding path carries that backend truth into terminal creation or terminal config reuse logic

#### Scenario: Existing stopped terminal can adopt the requested backend
- **GIVEN** terminal `shell-1` already exists with durable backend `xterm`
- **AND** that terminal is `not_started` or `stopped`
- **WHEN** a user runs `agenter shell --backend=ghostty-native`
- **THEN** cli-shell updates durable backend launch truth for `shell-1` to `ghostty-native`
- **AND** the next bootstrap uses `ghostty-native`

#### Scenario: Existing running terminal with another backend is rejected
- **GIVEN** terminal `shell-1` is already running with durable backend `xterm`
- **WHEN** a user runs `agenter shell --backend=ghostty-native`
- **THEN** cli-shell exits with a clear backend-mismatch error
- **AND** it does not silently attach as xterm
- **AND** it does not hot-swap the running backend in place

#### Scenario: Explicit backend failure does not silently fall back
- **WHEN** a user runs `agenter shell --backend=ghostty-native`
- **AND** the requested backend cannot be instantiated on the current host
- **THEN** cli-shell exits with an explicit backend-unavailable style error
- **AND** it does not silently create or attach an xterm-backed terminal

## MODIFIED Requirements

### Requirement: Cli-shell TUI SHALL intrude only at the bottom of the shell-terminal

Cli-shell SHALL render a terminal-first TUI whose first screen uses the shell-terminal primarily as an ordinary usable terminal surface. In the collapsed default state, the app UI SHALL intrude only as a one-row bottom projection. Any content rendered into that bottom row SHALL be produced by rendering markdown at constrained width and taking only the last rendered line. Multi-row bottom dialogue panels are forbidden.

#### Scenario: First screen shows one active terminal with one-line bottom toolbar
- **WHEN** cli-shell renders after orchestration succeeds
- **THEN** the main body renders ordinary terminal content for the active internal terminal
- **AND** Agenter status and controls are confined to one bottom toolbar row
- **AND** no top status line, header, route tabs, dashboard frame, left rail, shell list, session list, tab strip, or terminal switcher is rendered
- **AND** no persistent right-side room transcript pane is rendered

#### Scenario: Toolbar uses the required three-zone structure
- **WHEN** cli-shell renders app metadata
- **THEN** the bottom toolbar includes a status icon zone
- **AND** it includes a current Heartbeat zone
- **AND** it includes an action button zone
- **AND** the toolbar is visually distinguished primarily by background color

#### Scenario: Bottom projection is rendered from markdown and clipped to one line
- **WHEN** cli-shell renders Heartbeat or bottom dialogue-preview content
- **THEN** it first renders markdown with the current bottom-zone width constraint
- **AND** it displays only the last rendered visual line in the bottom row
- **AND** it does not allocate a second bottom content row for wrapped markdown

#### Scenario: App UI is rendered as terminal cells
- **WHEN** cli-shell renders toolbar, dialogue, borders, gutters, scrollbar, controls, backgrounds, or highlights
- **THEN** every visible app element maps to shell-terminal character cells
- **AND** borders are rendered through box-drawing or ASCII characters rather than pixel-only card edges
- **AND** backgrounds and highlights are applied as cell ranges
- **AND** wide emoji and CJK glyphs are measured with terminal-width semantics before layout is finalized

#### Scenario: Explicit transcript chrome uses side or floating separation
- **WHEN** cli-shell renders the explicit dialogue transcript
- **THEN** left and right placement use a single split line between terminal content and dialogue content
- **AND** floating placement may use a minimal outline only because it overlaps terminal content
- **AND** cli-shell does not render a multi-row bottom transcript panel

#### Scenario: Toolbar does not become a backend status dashboard
- **WHEN** cli-shell renders the default toolbar
- **THEN** it does not enumerate `terminal`, `room`, `superadmin`, `connected`, package source, or daemon status tags as independent dock chips
- **AND** backend facts appear only when projected by the current Heartbeat or diagnostics

#### Scenario: Optional separator is not a required content row
- **WHEN** cli-shell theme renders a separator between terminal body and bottom dock
- **THEN** the separator is purely visual
- **AND** the default app content still fits in one bottom row

#### Scenario: UI terminology distinguishes shell-terminal and terminal
- **WHEN** cli-shell renders labels or diagnostics
- **THEN** it uses `shell-terminal` for the user-launched terminal process when disambiguation is needed
- **AND** it uses `terminal` for the internal Agenter `terminalSystem` instance
- **AND** it does not use `SHELLS` or `SESSIONS` as a navigation label

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

#### Scenario: Heartbeat projection uses markdown last-line rendering
- **WHEN** the current Heartbeat zone contains markdown-rich content
- **THEN** cli-shell renders that content through `MarkdownRenderable` using the zone width constraint
- **AND** it projects only the last rendered line into the visible toolbar row
- **AND** markdown wrapping does not create another visible toolbar row

#### Scenario: Built-in tool calls get optimized toolbar summaries
- **WHEN** the current Heartbeat is operating message, terminal, or attention built-in tools
- **THEN** cli-shell renders a compact operation summary instead of raw tool payload
- **AND** raw tool truth remains available through backend event/message/terminal systems

#### Scenario: Toolbar action buttons expose managed mode and chat
- **WHEN** cli-shell renders toolbar actions
- **THEN** it renders a managed/takeover toggle button
- **AND** it renders a chat entry button with unread count
- **AND** the chat entry supports a keyboard shortcut and mouse activation

### Requirement: Cli-shell SHALL provide an explicit TUI dialogue panel

Cli-shell SHALL provide an Agenter dialogue transcript surface for the app room. The transcript surface SHALL be an explicit opened state, not a default pane and not part of the collapsed one-line bottom row. A `bottom` placement request is projection-only mode and SHALL NOT create a multi-row transcript panel.

#### Scenario: Dialogue panel opens on the right side
- **WHEN** the user invokes the configured dialogue-open gesture
- **THEN** cli-shell renders the app room conversation as a right-side dialogue panel
- **AND** the panel contains visible conversation structure such as user messages, Avatar replies, and a message input area
- **AND** the terminal remains the single active internal terminal

#### Scenario: Dialogue panel toolbar exposes placement and close actions
- **WHEN** the dialogue panel is open
- **THEN** its top toolbar renders placement actions for left, right, floating, and bottom-projection
- **AND** it renders a close action on the right side of that toolbar

#### Scenario: Bottom placement request returns to one-line projection only
- **WHEN** the user requests bottom placement from dialogue controls
- **THEN** cli-shell keeps the transcript out of multi-row bottom chrome
- **AND** it returns to the one-line bottom projection surface
- **AND** any bottom-visible room summary still follows markdown last-line projection law

#### Scenario: Dialogue panel reads from backend room truth
- **WHEN** the dialogue panel is open for `shell-1`
- **THEN** it renders messages from the durable app room for `shell-1`
- **AND** it does not keep a separate local transcript as authoritative truth

#### Scenario: Dialogue panel closes back to one-line default
- **WHEN** the dialogue panel is open
- **AND** the user closes or cancels it
- **THEN** cli-shell returns to the one-line bottom toolbar
- **AND** terminal input ownership returns to terminal mode

#### Scenario: Dialogue panel is not default chrome
- **WHEN** cli-shell renders the dialogue panel
- **THEN** it is visible only while explicitly opened
- **AND** it does not reduce the app to a dashboard layout

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

Cli-shell SHALL support left, right, and floating dialogue panel placement. `bottom` is reserved for the single-line projection surface and SHALL NOT be treated as a transcript panel. Initial placement and resize handling SHALL use deterministic smart placement based on available shell-terminal space and minimum viable thresholds.

#### Scenario: First open uses smart placement
- **WHEN** the user opens the dialogue panel for the first time
- **THEN** cli-shell chooses right placement if horizontal space is sufficient
- **AND** chooses floating placement as fallback

#### Scenario: Resize may trigger smart re-placement
- **WHEN** the shell-terminal is resized and the current placement falls below its minimum viable space threshold
- **THEN** cli-shell reruns smart placement
- **AND** it keeps the panel usable without creating a second terminal surface

#### Scenario: Bottom request keeps projection-only semantics
- **WHEN** the user or stored view state requests `bottom`
- **THEN** cli-shell keeps the transcript collapsed into the one-line bottom projection
- **AND** it does not render a multi-row bottom panel during smart placement or explicit placement

### Requirement: Cli-shell SHALL keep terminal input as the default input owner

Cli-shell SHALL forward shell-terminal input to the attached internal terminal by default. Explicit room input SHALL receive input only after an explicit app focus gesture. The collapsed one-line bottom projection is display-only and SHALL NOT buffer arbitrary terminal typing as compose text.

#### Scenario: Printable input goes to the terminal by default
- **WHEN** cli-shell is in terminal mode and the user types printable characters
- **THEN** cli-shell forwards those characters to internal terminal `shell-1`
- **AND** the bottom projection row does not receive or buffer them

#### Scenario: Terminal control keys remain terminal-owned by default
- **WHEN** cli-shell is in terminal mode and the user presses `Ctrl+C`
- **THEN** cli-shell forwards the interrupt to internal terminal `shell-1`
- **AND** cli-shell does not exit because of that keypress

#### Scenario: Collapsed bottom projection never becomes a multiline composer
- **WHEN** cli-shell is collapsed to the one-line bottom projection
- **THEN** markdown-rich status may be projected into that row
- **AND** the row does not expand into a multiline chat composer because of wrapping or input focus

#### Scenario: Explicit room input sends room message
- **WHEN** the user enters explicit room input through the configured focus gesture
- **AND** types a message and presses `Enter`
- **THEN** cli-shell sends that message to the app room
- **AND** it does not send the message text to the internal terminal
- **AND** focus returns to terminal mode after sending

#### Scenario: Room input cancel returns to terminal mode
- **WHEN** explicit room input is focused
- **AND** the user presses `Escape`
- **THEN** cli-shell discards the current draft
- **AND** focus returns to terminal mode
