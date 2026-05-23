## ADDED Requirements

### Requirement: cli-shell SHALL install a tmux-native product status bar

cli-shell SHALL configure the tmux session status line as the bottom product shell chrome. The status line SHALL expose the cli-shell session, selected Avatar, Avatar Heartbeat preview, clickable managed state, Help entry, and Chat entry. Dock pane fallback, Mouse toggle, Shell focus, and Refresh SHALL remain product-local expert key bindings rather than right-side status entries. cli-shell SHALL split identity and actions across status-left and status-right, hide the default tmux window list, configure status lengths so clickable actions remain visible in normal terminal widths, and highlight the active product surface with tmux status styling instead of repeating shortcut text as the main UI.
The Avatar Heartbeat preview SHALL be a cli-shell-local projection of runtime Heartbeat facts and SHALL NOT require restoring the old composed terminal surface or reading a TerminalSystem active product surface.
cli-shell SHALL set an explicit high-contrast status palette for status, status-left, and status-right and SHALL NOT depend on `#[default]` inside product status labels.

#### Scenario: Attach configures status before foreground attach

- **WHEN** cli-shell plans tmux attach for `--session=5 --avatar=bangeel`
- **THEN** the plan contains tmux status configuration steps before `attach-session`
- **AND** the status text includes `shell-5`
- **AND** the status text includes `@bangeel`
- **AND** the status text reads an Avatar Heartbeat preview from session-local tmux state
- **AND** the status text includes a Help entry hint
- **AND** the status text includes a Chat entry hint
- **AND** the status text does not use shortcut strings as the primary action labels
- **AND** the status text binds active action styling to `@agenter_cli_shell_active_action`
- **AND** the plan hides the default tmux window list so action entries are not pushed off screen
- **AND** the plan sets explicit status style options for status, status-left, and status-right
- **AND** the status labels do not reset through `#[default]`

### Requirement: cli-shell SHALL make status clicks the default and keep Mouse reversible

cli-shell SHALL enable tmux mouse support by default so non-tmux users can click the product status bar. cli-shell SHALL expose a product-local Mouse toggle, currently `Ctrl+b` then `m`; when Mouse is on, clickable status ranges for managed, Help, and Chat SHALL be active. When Mouse is off, native terminal text selection is restored and status clicks are unavailable until Mouse is enabled again.

#### Scenario: Status clicks are default and Mouse is reversible

- **WHEN** cli-shell plans tmux attach
- **THEN** the plan sets `mouse on`
- **AND** the plan binds `m` to toggle Mouse
- **AND** the status text marks user ranges for managed, Help, and Chat
- **AND** the plan binds `MouseDown1Status` to dispatch the clicked status range

#### Scenario: Managed click is routed to the runtime product action

- **WHEN** cli-shell plans tmux attach
- **THEN** the managed status label is wrapped in `range=user|managed`
- **AND** the mouse status dispatcher forwards that range to `tmux-action --action managed`
- **AND** the managed action is handled by cli-shell runtime code rather than the generic tmux action runner fallback

### Requirement: cli-shell SHALL provide a shortcut help panel

cli-shell SHALL provide a shortcut help popup reachable by keyboard and, when Mouse is enabled, by status bar click. The help panel SHALL explain status-bar clicking as the primary path, how to press tmux shortcuts in plain language, the managed toggle, Chat popup, Dock pane fallback, Mouse toggle, shell focus, copy-mode scroll, and popup exit behavior.

#### Scenario: Help popup is reachable by key and click

- **WHEN** cli-shell plans tmux attach
- **THEN** the plan binds `?` to a `display-popup` help command
- **AND** clicking the Help status range opens the same help command when Mouse is enabled
- **AND** the help text explains clicking managed, Help, and Chat
- **AND** the help text explains pressing `Ctrl+b`, releasing it, then pressing the next key
- **AND** the help text includes `Ctrl+b, then c`
- **AND** the help text explains that turning Mouse off restores native text selection

### Requirement: cli-shell SHALL toggle managed state through hosting attention

cli-shell SHALL make the `managed:on/off` status label clickable. Clicking it SHALL execute a cli-shell product action that commits or settles room-bound hosting attention for the selected Avatar and then refreshes the session-local tmux managed option. Because tmux-hosted cli-shell does not have a TerminalSystem visible terminal id, the action SHALL use an extension-local `surfaceId` such as `tmux:shell-5` in attention provenance and SHALL NOT create or mutate TerminalSystem terminals.

#### Scenario: Managed status click toggles hosting attention

- **GIVEN** managed state is off
- **WHEN** the user clicks the managed status range
- **THEN** cli-shell commits `scores: {"hosting": 1000}` for the shell hosting context
- **AND** the attention body/meta name the extension-local tmux surface and bound MessageRoom
- **AND** tmux refreshes `@agenter_cli_shell_managed` to `on`
- **AND** TerminalSystem terminals are not created or modified

#### Scenario: Managed status click settles hosting attention

- **GIVEN** managed state is on
- **WHEN** the user clicks the managed status range
- **THEN** cli-shell settles the shell hosting context with `scores: {"hosting": 0}` and reason `user_disabled`
- **AND** tmux refreshes `@agenter_cli_shell_managed` to `off`
- **AND** TerminalSystem terminals are not created or modified

### Requirement: cli-shell SHALL open OpenTUI Chat through a tmux popup by default

cli-shell SHALL treat Chat as an on-demand product entry. The default Chat key binding SHALL delegate to the product-owned `tmux-action` command, and that action SHALL run the MessageRoom OpenTUI surface through `tmux display-popup` instead of creating a permanent split pane during default attach. The popup SHALL keep an exit status visible and wait for the user to close it after the room command exits unexpectedly. Normal titlebar close and layout switching SHALL close the old surface immediately.
tmux SHALL act only as the local popup/pane host for Chat; the `room` subcommand SHALL remain an OpenTUI MessageRoom UI and SHALL NOT regress to a plain text console fallback.
The OpenTUI Chat titlebar SHALL expose a close control. Its `◨`, `◧`, and `⿴` controls SHALL request tmux-owned layout changes for left dock, right dock, and cover popup respectively. These controls SHALL NOT resize or reposition the Chat surface's own OpenTUI title/body/status/draft renderables as an internal layout mode.
cli-shell SHALL treat Chat as a singleton surface per tmux session and Avatar. If an existing Chat pane is present, the `Chat` action SHALL focus that pane and update session-local Chat state instead of opening a second popup. When switching an existing Chat pane between left and right dock positions, cli-shell SHALL move/rejoin the existing tmux pane instead of killing the Room process. When switching from a pane to a cover popup, cli-shell SHALL close the existing pane first because tmux popups cannot host a moved live pane. Chat singleton state SHALL be stored in tmux session-local options and verified by pane discovery, not in process-local JS state.
Any tmux format intended for a nested tmux command inside `run-shell` SHALL be deferred with `##{...}` so the outer tmux invocation does not expand it before the inner pane discovery command runs.

#### Scenario: Chat entry is a popup binding

- **WHEN** cli-shell plans tmux attach
- **THEN** the plan binds the Chat key to a short `tmux-action --action chat` command
- **AND** the action command opens `display-popup`
- **AND** the popup command runs the launcher-provided cli-shell bin argv with `room --session=<shellName> --avatar=<avatar>`
- **AND** the `room` subcommand starts the OpenTUI MessageRoom surface
- **AND** active cli-shell sources depend on `@opentui/core` for that room surface
- **AND** active cli-shell sources do not wire the popup to a text-only `room-console` implementation
- **AND** the room titlebar exposes a close control
- **AND** the room titlebar layout controls delegate to `tmux-action --action layout-*`
- **AND** the popup command displays a close prompt if the room command exits unexpectedly
- **AND** the popup command exits directly after normal titlebar close or layout switching
- **AND** the default attach plan does not execute `split-window` for Chat

#### Scenario: Existing Chat pane is focused instead of duplicated

- **GIVEN** a cli-shell tmux session already has a Chat pane for the same session and Avatar
- **WHEN** the user triggers the `Chat` action from the status bar or key binding
- **THEN** cli-shell focuses the existing Chat pane
- **AND** no second Chat popup or pane is opened
- **AND** tmux session-local options record `chat_surface=pane` and the existing Chat pane id
- **AND** nested tmux pane discovery uses deferred `##{pane_id}` / `##{pane_start_command}` formats

#### Scenario: Existing Chat pane changes left or right without restarting Room

- **GIVEN** a cli-shell tmux session already has a Chat pane
- **WHEN** the Room titlebar requests left or right dock layout
- **THEN** cli-shell uses tmux pane movement to place the existing pane
- **AND** cli-shell does not kill that pane before opening another Room process
- **AND** the session-local Chat pane option continues to point at the same pane id

#### Scenario: Room input exposes a cursor

- **WHEN** the OpenTUI Room surface is rendered
- **THEN** the message draft control is an editable OpenTUI input surface
- **AND** the input surface is focused by default
- **AND** the user can see a cursor while typing in Room

### Requirement: cli-shell SHALL render approval requests in an independent top layer

cli-shell SHALL NOT render terminal write approval prompts inside the MessageRoom surface. cli-shell SHALL provide an OpenTUI `shell top` surface that can be opened as a tmux top-layer popup. The top surface SHALL subscribe to terminal permission requests, show pending approvals, and support keyboard and mouse approve/deny actions. Room MAY request that the tmux host opens `shell top` when it observes pending approvals, but Room SHALL NOT own or render the approval card.

#### Scenario: Pending approval opens a product top layer instead of a Room overlay

- **GIVEN** the Room surface observes a pending terminal write approval
- **WHEN** cli-shell is running inside the tmux product host
- **THEN** Room requests the `top` tmux action
- **AND** Room does not render an approval overlay inside its own render tree
- **AND** the `top` action opens an OpenTUI `shell top` popup

#### Scenario: Approval top layer supports mouse and keyboard

- **GIVEN** `shell top` renders a pending terminal write approval
- **WHEN** the user clicks Approve
- **THEN** cli-shell approves the terminal request through the client-sdk store
- **WHEN** the user clicks Deny
- **THEN** cli-shell denies the terminal request through the client-sdk store
- **AND** equivalent keyboard shortcuts are available for approve, deny, and close

### Requirement: cli-shell SHALL provide an explicit Chat pane fallback

cli-shell SHALL provide a key binding that opens or focuses a Chat pane as a fallback for users who prefer a persistent room pane or cannot use tmux popup.

#### Scenario: Pane fallback is bound but not default

- **WHEN** cli-shell plans tmux attach
- **THEN** the plan binds a Chat pane fallback key
- **AND** the fallback command uses `split-window`
- **AND** the fallback command is not executed before attach by default

### Requirement: cli-shell SHALL provide product-local key bindings

cli-shell SHALL install product-local tmux key bindings for Help, Chat popup, Chat pane fallback, shell focus, and status refresh.

#### Scenario: Product keys are installed

- **WHEN** cli-shell plans tmux attach
- **THEN** the plan binds `c` for Chat popup
- **AND** it binds `C` for Chat pane fallback
- **AND** it binds `m` for Mouse toggle
- **AND** it binds `s` for shell focus
- **AND** it binds `r` for status refresh
- **AND** it binds `?` for shortcut help

#### Scenario: Status refresh updates the Avatar Heartbeat preview

- **WHEN** cli-shell runs the product-local status refresh action
- **THEN** the action reads the runtime Heartbeat projection through cli-shell code
- **AND** the action writes the resulting one-line preview into the current tmux session option
- **AND** tmux refreshes the status line after the option is updated

### Requirement: cli-shell SHALL isolate tmux product state

cli-shell SHALL run attach, status, binding, popup, pane, and cleanup tmux commands inside a cli-shell-owned tmux socket namespace. Product key bindings SHALL read session-local tmux options for Avatar, daemon endpoint, workspace, and managed state instead of hard-coding one cli-shell session into global tmux bindings.
Product key bindings SHALL keep tmux binding strings short by delegating to `tmux-action`; full product actions SHALL be implemented in cli-shell extension code so tmux format tokens do not leak into the shell process as literal URLs or arguments.

#### Scenario: Product bindings are isolated and session-local

- **WHEN** cli-shell plans tmux attach
- **THEN** every tmux command targets the cli-shell-owned socket namespace
- **AND** the Chat binding reads `#{session_name}` for the target shell
- **AND** the Chat binding reads the Avatar from a cli-shell session option
- **AND** the Chat binding delegates to `tmux-action --action chat`
- **AND** the action runner receives concrete shell and Avatar values before it runs the room command
- **AND** cleanup lists and kills sessions through the same cli-shell-owned socket namespace
