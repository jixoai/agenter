# cli-shell-product Specification

## Purpose

Define `@agenter/cli-shell` as an extension TUI product that binds and renders core-system resources without redefining Shell, Room, prompt, or authorization truth.
## Requirements
### Requirement: Cli-shell SHALL parse Avatar selection and product session separately

Cli-shell SHALL treat Avatar identity and cli-shell session identity as two different things. `--avatar` selects the AvatarRuntime. `--session` selects the cli-shell product resource key. `--create-avatar` only allows creating a missing ordinary Avatar. `--clear-avatar` only clears runtime session state for the selected Avatar in the current workspace. None of these flags SHALL create a special test Avatar concept.

#### Scenario: Default command selects shell-assistant and shell-1

- **WHEN** a user runs `agenter shell`
- **THEN** cli-shell resolves Avatar nickname `shell-assistant`
- **AND** it resolves product resource key `shell-1`

#### Scenario: Explicit Avatar overrides the default assistant

- **WHEN** a user runs `agenter shell --avatar=bangeel --session=7`
- **THEN** cli-shell selects Avatar `bangeel`
- **AND** it resolves product resource key `shell-7`
- **AND** it does not reinterpret `shell-7` as runtime identity

#### Scenario: Clear-avatar only clears runtime session state

- **WHEN** a user runs `agenter shell --avatar=bangeel --clear-avatar`
- **THEN** cli-shell clears the selected Avatar runtime session/context in the current workspace before bootstrap
- **AND** it does not delete `AGENTER.mdx`, memory files, tmux sessions, MessageRoom resources, or Avatar principal records

### Requirement: Cli-shell SHALL be a TUI projection over core systems

Cli-shell SHALL be an extension TUI product that binds and renders core-system resources. Shell truth SHALL remain in TerminalSystem. Room truth SHALL remain in MessageSystem. Prompt truth SHALL remain in Core/AvatarRuntime through `AGENTER.mdx`. Authorization truth SHALL remain in TerminalSystem. cli-shell SHALL own only product grammar, local TUI layout, local host/process choice, and lifecycle orchestration through generic SDK contracts.

#### Scenario: Cli-shell start binds core resources

- **WHEN** a user runs `bun agenter shell --session=7 --avatar=bangeel`
- **THEN** cli-shell binds product resource key `shell-7`
- **AND** it obtains or ensures a TerminalSystem terminal through generic product binding
- **AND** it obtains or ensures a MessageSystem room through generic product binding
- **AND** it starts or selects the AvatarRuntime through generic runtime APIs
- **AND** it does not replace those identities with tmux pane ids as durable truth

#### Scenario: Cli-shell does not restore terminal-2 product chrome

- **WHEN** cli-shell renders status, Chat, top layer, or layout controls
- **THEN** those UI elements remain product TUI projections
- **AND** TerminalSystem is not asked to store cli-shell chrome as a composed product terminal
- **AND** no `terminalRuntimeKind=composed`, `composedShellTerminalId`, or `ProductTerminalComposedSurfaceState` is required for active cli-shell runtime

#### Scenario: Cli-shell does not make tmux the Shell truth

- **WHEN** cli-shell uses tmux as a local host or layout container
- **THEN** tmux pane ids remain presentation/process-host identities
- **AND** terminal read/write/await, approval, grant, lifecycle, and AI terminal observation continue to target the bound TerminalSystem terminal id

### Requirement: Cli-shell SHALL resolve the current shell target from product binding

Cli-shell SHALL resolve the current shell target from the product binding created during bootstrap. Neither the TUI nor the Avatar SHALL need to infer the current shell by scanning stale global terminal catalogs or tmux pane lists.

#### Scenario: Fresh session ignores stale terminal residue

- **GIVEN** stale legacy resources such as `shell-4:terminal-2` or `shell-5:terminal-2` still exist
- **WHEN** cli-shell starts `--session=7 --avatar=bangeel`
- **THEN** the current shell target is the TerminalSystem terminal bound to `shell-7`
- **AND** stale resources are not selected as write targets
- **AND** Avatar-visible product facts identify the current bound terminal

#### Scenario: Re-entering a session restores the same binding

- **WHEN** a user exits and later re-enters `--session=6 --avatar=bangeel`
- **THEN** cli-shell restores or reuses the product binding for `shell-6`
- **AND** it does not report that there is no independent terminal merely because tmux state or old TerminalSystem residue disagrees

### Requirement: Cli-shell SHALL render Room and approval as separate TUI surfaces

Cli-shell SHALL render MessageRoom as a MessageSystem surface and terminal approval as a TerminalSystem surface. Room MAY nudge the product shell to open a top layer when pending approvals exist, but Room SHALL NOT own approval truth.

#### Scenario: Room stays MessageSystem only

- **WHEN** the Chat/Room panel renders
- **THEN** its transcript and send action use MessageSystem room APIs
- **AND** it does not render TerminalSystem approval state as part of the room message list

#### Scenario: Approval top layer uses TerminalSystem APIs

- **WHEN** a pending terminal write approval exists
- **THEN** cli-shell top layer displays that TerminalSystem request
- **AND** approve/deny calls TerminalSystem approval APIs
- **AND** the approval result is observed from TerminalSystem updates

### Requirement: Cli-shell managed state SHALL remain attention projection

Cli-shell managed/on/off SHALL be a product-scoped attention fact and a TUI projection. It SHALL NOT grant terminal authority, alter TerminalSystem mode, or become local host truth.

#### Scenario: Managed click commits attention only

- **WHEN** the user enables managed mode from cli-shell
- **THEN** cli-shell commits a product-scoped attention item with `scores: {"hosting": 1000}`
- **AND** the item references the bound terminal id and room id as provenance
- **AND** no terminal grant, lease, or TerminalSystem mode is created solely because managed is on

#### Scenario: Managed off settles attention only

- **WHEN** the user disables managed mode from cli-shell
- **THEN** cli-shell settles the product-scoped hosting attention with `scores: {"hosting": 0}`
- **AND** terminal grants, approval requests, and leases remain governed by TerminalSystem

### Requirement: Cli-shell local host choice SHALL be replaceable

Cli-shell MAY use tmux, OpenTUI, a native terminal host, process IPC, or future local composition mechanisms for presentation. That choice SHALL be replaceable without changing TerminalSystem, MessageSystem, AvatarRuntime, AttentionSystem, or product binding truth.

#### Scenario: Tmux can be swapped without changing system truth

- **WHEN** cli-shell changes from tmux hosting to another TUI host
- **THEN** the bound TerminalSystem terminal id remains the shell truth
- **AND** the bound MessageSystem room id remains the room truth
- **AND** the selected AvatarRuntime and attention contexts remain unchanged

### Requirement: Cli-shell SHALL own product-local settings and keybindings

Cli-shell SHALL keep its product-local preferences under `~/.agenter/cli-shell/`. `settings.json` stores durable product behavior such as the default Chat layout. `keybindings.json` stores product shortcut bindings for the Room composer and related panels. Missing, empty, or invalid product config files SHALL fall back to cli-shell defaults instead of mutating shared core settings truth.

#### Scenario: Missing product config falls back to cli-shell defaults

- **WHEN** cli-shell starts and `~/.agenter/cli-shell/settings.json` or `keybindings.json` does not exist, is empty, or is invalid
- **THEN** cli-shell uses built-in product defaults
- **AND** it does not write into shared core settings state just to recover those defaults

#### Scenario: Persisted Chat layout reopens the singleton Chat surface consistently

- **GIVEN** cli-shell has saved a default Chat layout of `left`, `right`, or `cover`
- **WHEN** the singleton Chat surface is currently closed and the user opens Chat again
- **THEN** cli-shell reopens Chat using that saved default layout

### Requirement: Cli-shell Room SHALL use a multiline composer host

Cli-shell Room SHALL use a multiline textarea composer. The composer area SHALL support plain draft editing, panel-style slash-command surfaces, and inline confirm surfaces without moving Room truth into MessageSystem.

#### Scenario: Room composer supports panel-style slash commands

- **WHEN** the user invokes a panel-style command such as `/history`
- **THEN** cli-shell temporarily replaces the textarea surface with a panel in the same composer area
- **AND** escaping that panel returns focus to the textarea composer

#### Scenario: History can replace or insert into a non-empty draft

- **GIVEN** the current Room draft is non-empty
- **WHEN** the user selects an item from `/history`
- **THEN** cli-shell opens an inline confirm surface
- **AND** the user can either replace the draft or insert the history item at the current cursor position

### Requirement: Cli-shell Room send SHALL separate send success from refresh failure

Cli-shell SHALL treat room-message send success and follow-up snapshot refresh failure as separate product facts. A successful send SHALL clear the draft immediately. A later refresh failure SHALL surface as a recoverable notice instead of rewriting the send result into failure.

#### Scenario: Refresh failure does not cancel a successful send

- **WHEN** Room message send succeeds
- **AND** the follow-up room refresh fails
- **THEN** cli-shell clears the draft
- **AND** it preserves the successful send result
- **AND** it surfaces refresh failure as a separate recoverable notice

### Requirement: Cli-shell shell-pane cursor projection SHALL keep native offset law

Cli-shell shell-pane projection SHALL keep cursor truth in 0-based viewport-local cells until the final native cursor commit. The required `+1` conversion for native terminal coordinates SHALL happen only at the native cursor commit site so the historical `(-1,-1)` drift does not return through intermediate projection layers.

#### Scenario: Non-zero render origin still yields the correct native cursor

- **GIVEN** the shell-pane renderable has a non-zero screen origin
- **WHEN** cli-shell commits the hardware cursor for a visible viewport-local cursor
- **THEN** the native cursor position uses renderable screen origin plus the viewport-local cursor plus the single 1-based native offset

### Requirement: Cli-shell SHALL use normalized tmux product actions for status clicks

Cli-shell SHALL normalize tmux status-bar mouse range payloads before dispatching product actions. The action boundary SHALL accept both direct action names such as `help` and user-range forms such as `user|help` for known product actions. Unknown range payloads SHALL fail as unknown actions without mutating Chat surface state.

#### Scenario: Help click normalizes user range

- **WHEN** tmux dispatches `mouse_status_range = user|help` to `tmux-action`
- **THEN** cli-shell executes the same Help popup action as `help`
- **AND** it does not report `unknown-action`

#### Scenario: Chat click normalizes user range

- **WHEN** tmux dispatches `mouse_status_range = user|chat` to `tmux-action`
- **THEN** cli-shell executes the same Chat toggle action as `chat`
- **AND** it does not report `unknown-action`

#### Scenario: Help takes over an existing popup on the same client

- **GIVEN** the Chat surface state is popup
- **WHEN** the user clicks Help or presses the Help shortcut on the same tmux client
- **THEN** cli-shell closes the existing client popup before opening Help
- **AND** it clears the Chat popup presentation state
- **AND** it restores the status highlight after Help closes

### Requirement: Cli-shell Chat SHALL be a singleton tmux surface

Cli-shell SHALL maintain exactly one visible Chat surface per tmux session and selected Avatar. The legal presentation states are closed, popup, and pane. Status-bar Chat, dock fallback, and Room titlebar layout requests SHALL all transition that same state instead of creating independent Room owners.

#### Scenario: Chat status action toggles closed to saved default layout

- **GIVEN** the Chat surface state is closed
- **WHEN** the user clicks Chat or presses the Chat shortcut
- **THEN** cli-shell opens one Room surface using the saved default layout
- **AND** the active status highlight changes to Chat

#### Scenario: Chat status action toggles popup closed

- **GIVEN** the Chat surface state is popup
- **WHEN** the user clicks Chat or presses the Chat shortcut again
- **THEN** cli-shell closes that popup surface
- **AND** it restores shell focus and shell status highlight
- **AND** it does not start a second Room process

#### Scenario: Chat status action toggles pane closed

- **GIVEN** the Chat surface state is pane with a valid pane id
- **WHEN** the user clicks Chat or presses the Chat shortcut again
- **THEN** cli-shell kills only that Chat pane
- **AND** it restores focus to a remaining shell pane
- **AND** it clears the Chat surface state

#### Scenario: Layout request moves singleton pane without restarting Room

- **GIVEN** the singleton Chat surface is visible as a pane
- **WHEN** the user requests the opposite pane layout from the Room titlebar
- **THEN** cli-shell moves the same tmux pane to the requested side
- **AND** it does not start a second Room process
- **AND** it does not kill the existing Room pane

#### Scenario: Layout request moves singleton from pane to popup

- **GIVEN** the singleton Chat surface is visible as a pane
- **WHEN** the user requests cover layout from the Room titlebar
- **THEN** cli-shell closes the pane before opening the popup Room surface
- **AND** only one Room surface remains visible

#### Scenario: Layout request moves singleton from popup to pane

- **GIVEN** the singleton Chat surface is visible as a popup
- **WHEN** the user requests left or right layout from the Room titlebar
- **THEN** cli-shell closes the popup and opens one pane Room surface
- **AND** only one Room surface remains visible

