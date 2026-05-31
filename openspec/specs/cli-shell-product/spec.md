# cli-shell-app Specification

## Purpose

Define `agenter-app-shell` as an extension TUI app that binds and renders core-system resources without redefining Shell, Room, prompt, or authorization truth.
## Requirements
### Requirement: Cli-shell SHALL parse Avatar selection and app session separately

Cli-shell SHALL treat Avatar identity and cli-shell session identity as two different things. `--avatar` selects the AvatarRuntime. `--session` selects the cli-shell app resource key. `--create-avatar` only allows creating a missing ordinary Avatar. `--clear-avatar` only clears runtime session state for the selected Avatar in the current workspace. None of these flags SHALL create a special test Avatar concept.

#### Scenario: Default command selects shell-assistant and shell-1

- **WHEN** a user runs `agenter shell`
- **THEN** cli-shell resolves Avatar nickname `shell-assistant`
- **AND** it resolves app resource key `shell-1`

#### Scenario: Explicit Avatar overrides the default assistant

- **WHEN** a user runs `agenter shell --avatar=bangeel --session=7`
- **THEN** cli-shell selects Avatar `bangeel`
- **AND** it resolves app resource key `shell-7`
- **AND** it does not reinterpret `shell-7` as runtime identity

#### Scenario: Clear-avatar only clears runtime session state

- **WHEN** a user runs `agenter shell --avatar=bangeel --clear-avatar`
- **THEN** cli-shell clears the selected Avatar runtime session/context in the current workspace before bootstrap
- **AND** it does not delete `AGENTER.mdx`, memory files, tmux sessions, MessageRoom resources, or Avatar principal records

### Requirement: Cli-shell SHALL be a TUI projection over core systems

Cli-shell SHALL be an extension TUI app that binds and renders core-system resources. Shell truth SHALL remain in TerminalSystem. Room truth SHALL remain in MessageSystem. Prompt truth SHALL remain in Core/AvatarRuntime through `AGENTER.mdx`. Authorization truth SHALL remain in TerminalSystem. cli-shell SHALL own only app grammar, local TUI layout, local host/process choice, and lifecycle orchestration through generic SDK contracts.

#### Scenario: Cli-shell start binds core resources

- **WHEN** a user runs `bun agenter shell --session=7 --avatar=bangeel`
- **THEN** cli-shell binds app resource key `shell-7`
- **AND** it obtains or ensures a TerminalSystem terminal through generic app binding
- **AND** it obtains or ensures a MessageSystem room through generic app binding
- **AND** it starts or selects the AvatarRuntime through generic runtime APIs
- **AND** it does not replace those identities with tmux pane ids as durable truth

#### Scenario: Cli-shell does not restore terminal-2 app chrome

- **WHEN** cli-shell renders status, Chat, top layer, or layout controls
- **THEN** those UI elements remain app TUI projections
- **AND** TerminalSystem is not asked to store cli-shell chrome as a composed app terminal
- **AND** no `terminalRuntimeKind=composed`, `composedShellTerminalId`, or `AppTerminalComposedSurfaceState` is required for active cli-shell runtime

#### Scenario: Cli-shell does not make tmux the Shell truth

- **WHEN** cli-shell uses tmux as a local host or layout container
- **THEN** tmux pane ids remain presentation/process-host identities
- **AND** terminal read/write/await, approval, grant, lifecycle, and AI terminal observation continue to target the bound TerminalSystem terminal id

### Requirement: Cli-shell SHALL resolve the current shell target from app binding

Cli-shell SHALL resolve the current shell target from the app binding created during bootstrap. Neither the TUI nor the Avatar SHALL need to infer the current shell by scanning stale global terminal catalogs or tmux pane lists.

#### Scenario: Fresh session ignores stale terminal residue

- **GIVEN** stale legacy resources such as `shell-4:terminal-2` or `shell-5:terminal-2` still exist
- **WHEN** cli-shell starts `--session=7 --avatar=bangeel`
- **THEN** the current shell target is the TerminalSystem terminal bound to `shell-7`
- **AND** stale resources are not selected as write targets
- **AND** Avatar-visible app facts identify the current bound terminal

#### Scenario: Re-entering a session restores the same binding

- **WHEN** a user exits and later re-enters `--session=6 --avatar=bangeel`
- **THEN** cli-shell restores or reuses the app binding for `shell-6`
- **AND** it does not report that there is no independent terminal merely because tmux state or old TerminalSystem residue disagrees

### Requirement: Cli-shell SHALL render Room and approval as separate TUI surfaces

Cli-shell SHALL render MessageRoom as a MessageSystem surface and terminal approval as a TerminalSystem surface. Room MAY nudge the app shell to open a top layer when pending approvals exist, but Room SHALL NOT own approval truth.

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

Cli-shell managed/on/off SHALL be a app-scoped attention fact and a TUI projection. It SHALL NOT grant terminal authority, alter TerminalSystem mode, or become local host truth.

#### Scenario: Managed click commits attention only

- **WHEN** the user enables managed mode from cli-shell
- **THEN** cli-shell commits a app-scoped attention item with `scores: {"hosting": 1000}`
- **AND** the item references the bound terminal id and room id as provenance
- **AND** no terminal grant, lease, or TerminalSystem mode is created solely because managed is on

#### Scenario: Managed off settles attention only

- **WHEN** the user disables managed mode from cli-shell
- **THEN** cli-shell settles the app-scoped hosting attention with `scores: {"hosting": 0}`
- **AND** terminal grants, approval requests, and leases remain governed by TerminalSystem

### Requirement: Cli-shell local host choice SHALL be replaceable

Cli-shell MAY use tmux, OpenTUI, a native terminal host, process IPC, or future local composition mechanisms for presentation. That choice SHALL be replaceable without changing TerminalSystem, MessageSystem, AvatarRuntime, AttentionSystem, or app binding truth.

#### Scenario: Tmux can be swapped without changing system truth

- **WHEN** cli-shell changes from tmux hosting to another TUI host
- **THEN** the bound TerminalSystem terminal id remains the shell truth
- **AND** the bound MessageSystem room id remains the room truth
- **AND** the selected AvatarRuntime and attention contexts remain unchanged

### Requirement: Cli-shell SHALL own app-local settings and keybindings

Cli-shell SHALL keep its app-local preferences under `~/.agenter/cli-shell/`. `settings.json` stores durable app behavior such as the default Chat layout. `keybindings.json` stores app shortcut bindings for the Room composer and related panels. Missing, empty, or invalid app config files SHALL fall back to cli-shell defaults instead of mutating shared core settings truth. The built-in Chat default layout SHALL be `right`.

#### Scenario: Missing app config falls back to cli-shell defaults

- **WHEN** cli-shell starts and `~/.agenter/cli-shell/settings.json` or `keybindings.json` does not exist, is empty, or is invalid
- **THEN** cli-shell uses built-in app defaults
- **AND** the built-in Chat layout default is `right`
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

Cli-shell SHALL treat room-message send success and follow-up snapshot refresh failure as separate app facts. A successful send SHALL clear the draft immediately. A later refresh failure SHALL surface as a recoverable notice instead of rewriting the send result into failure.

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

### Requirement: Cli-shell SHALL use normalized tmux app actions for status clicks

Cli-shell SHALL normalize tmux status-bar mouse range payloads before dispatching app actions. The action boundary SHALL accept both direct action names such as `help` and user-range forms such as `user|help` for known app actions. Unknown range payloads SHALL fail as unknown actions without mutating Chat surface state.

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

Cli-shell SHALL maintain exactly one visible Chat surface per tmux session and selected Avatar. The legal presentation states are closed, popup, and pane. Default tmux attach SHALL open or reuse the singleton Chat surface as a right dock pane. Status-bar Chat, dock fallback, and Room titlebar layout requests SHALL all transition that same state instead of creating independent Room owners.

#### Scenario: Default attach opens Chat on the right

- **WHEN** cli-shell attaches to a tmux app session
- **THEN** it opens or reuses one Chat Room surface as a right dock pane
- **AND** the bottom status bar remains part of the clickable tmux pane layout
- **AND** no second Room surface is created if a matching Room pane already exists

#### Scenario: Chat status action toggles closed to saved default layout

- **GIVEN** the Chat surface state is closed
- **WHEN** the user clicks Chat or presses the Chat shortcut
- **THEN** cli-shell opens one Room surface using the saved default layout
- **AND** the active status highlight changes to Chat

#### Scenario: Cover popup is modal for status-bar mouse controls

- **GIVEN** the singleton Chat surface is visible as a popup
- **WHEN** the user relies on mouse clicks in the bottom tmux status bar
- **THEN** cli-shell does not promise those clicks as the primary control path
- **AND** the user can leave cover mode through the Chat titlebar or keyboard flow

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

### Requirement: Cli-shell entry SHALL select Terminal/Room bindings

The cli-shell interactive entry flow SHALL treat an existing Shell row as one app-owned Terminal/Room binding projection. The projection SHALL be keyed by `appId=shell` and the normalized app `resourceKey`, with Terminal truth read from TerminalSystem and Room truth read from MessageSystem. AvatarRuntime remains the runtime identity owner, but selecting an existing Terminal SHALL NOT open a follow-up Avatar picker and SHALL NOT treat entry as room-user management. Creating a new Terminal remains an Avatar-backed bootstrap flow and SHALL still ask for Avatar selection when no explicit `--avatar` is supplied.

#### Scenario: Existing Terminal enters directly

- **GIVEN** `agenter shell` runs in an interactive TTY without an explicit `--session`
- **AND** the operator selects an existing Shell-bound Terminal row
- **WHEN** the row has a bound Room and a deterministic runtime identity for the binding
- **THEN** cli-shell completes entry for that Terminal/Room pair immediately
- **AND** no `Select Avatar` step is shown after the Terminal selection
- **AND** the selected app resource key remains the durable Shell binding identity

#### Scenario: Explicit Avatar remains an explicit runtime override

- **GIVEN** the operator starts Shell with an explicit `--avatar`
- **WHEN** cli-shell bootstraps a new Terminal/Room binding under that explicit input
- **THEN** the explicit AvatarRuntime selection is honored through the existing app runtime contract
- **AND** the interactive existing-Terminal path still does not ask for an Avatar after Terminal selection

#### Scenario: New Terminal still asks for Avatar

- **GIVEN** `agenter shell` runs in an interactive TTY without an explicit `--session`
- **AND** the operator selects the New Terminal row
- **WHEN** no explicit `--avatar` was supplied
- **THEN** cli-shell opens the Avatar selection step before bootstrap
- **AND** the selected AvatarRuntime becomes the runtime identity for the newly created Terminal/Room binding

#### Scenario: Room user management is not an entry side effect

- **GIVEN** a Shell-bound Terminal/Room pair already exists
- **WHEN** the operator enters it through the Select Terminal panel
- **THEN** cli-shell does not add a new Avatar participant, issue a new room grant, or issue a new terminal grant solely because the row was selected
- **AND** adding, removing, or re-permissioning Avatars for the active binding happens through the explicit Room/Chat `/avatar` command panel

### Requirement: Cli-shell entry projection SHALL preserve ownership boundaries

The Select Terminal model SHALL be an app-owned projection over core-system facts. It MAY join TerminalSystem terminal entries, MessageSystem room entries, grants, participants, AvatarRuntime identity evidence, and the authenticated superadmin scope for display and readiness decisions. It SHALL NOT move Terminal, Room, AvatarRuntime, grant, participant, or auth truth into Shell-local state.

#### Scenario: Projection joins facts without becoming truth

- **GIVEN** TerminalSystem has a Shell-bound terminal with resource key `shell-N`
- **AND** MessageSystem has a Shell-bound room with the same resource key
- **WHEN** cli-shell builds the Select Terminal model
- **THEN** the model exposes one selectable Terminal item for that binding
- **AND** it records terminal id, room id, resource key, lifecycle/status fields, and direct-entry readiness as projection data
- **AND** TerminalSystem and MessageSystem remain the only authorities for their underlying resources

#### Scenario: Terminal/Room mismatch is visible

- **GIVEN** a Shell-bound terminal exists without a matching Shell-bound room for the same app resource key
- **WHEN** cli-shell builds the Select Terminal model
- **THEN** the row is not silently treated as a complete direct-entry binding
- **AND** the row exposes a repair or unavailable state that explains the missing Room binding

### Requirement: Cli-shell Select Terminal rows SHALL expose structured fields

The Select Terminal panel SHALL render existing Terminal rows from structured fields rather than a single flattened label. At minimum, an existing row SHALL expose distinct field roles for resource key, terminal lifecycle/status, terminal title, path or terminal id fallback, and people mentions. The renderer SHALL visually distinguish those roles with separate color/style tokens while keeping the row compact enough for the OpenTUI startup panel.

#### Scenario: Row fields remain distinguishable

- **GIVEN** a Shell-bound Terminal has resource key `shell-7`, process phase `running`, title `dev`, and current path `/repo`
- **WHEN** the Select Terminal panel renders that row
- **THEN** the row presents those facts as separate key, status, title, and detail fields
- **AND** the fields use different visual roles instead of one undifferentiated text color

#### Scenario: Row truncation preserves field identity

- **GIVEN** the terminal width is too small to display every field in full
- **WHEN** the Select Terminal panel renders existing rows
- **THEN** truncation preserves the row's field order and selected-row affordance
- **AND** it does not merge people mentions into the terminal title or resource key

### Requirement: Cli-shell rows SHALL show other Room people

For each existing Terminal row with a bound Room, cli-shell SHALL derive a display-only people projection from the bound Room's participant/grant facts and render other visible room participants as mention tokens such as `@AAA @BBB`. The projection MUST exclude the current superadmin control identity by canonical auth/contact/actor identity, not by display-label guessing. The people projection SHALL NOT become membership truth.

#### Scenario: Current superadmin is excluded from mentions

- **GIVEN** the current authenticated operator is superadmin actor `auth:root`
- **AND** the bound Room includes participants for `auth:root`, Avatar `AAA`, and Avatar `BBB`
- **WHEN** cli-shell renders the Select Terminal row for that Room
- **THEN** the people field displays `@AAA @BBB`
- **AND** it does not display `@root` or another token for the current superadmin control actor

#### Scenario: Mention labels are display projection only

- **GIVEN** a Room participant has a resolved label
- **WHEN** cli-shell renders the people field
- **THEN** the mention token may use that label for display
- **AND** the underlying participant id remains the canonical room actor id
- **AND** changing the rendered token does not mutate Room participants or grants

### Requirement: Cli-shell Room SHALL provide an OpenTUI avatar management panel

Cli-shell Room SHALL implement `/avatar` as an OpenTUI panel-style command surface inside the Room composer area. The panel SHALL manage Avatars for the active Shell Terminal/Room binding by adding an Avatar, removing an Avatar, and configuring that Avatar's Room and Terminal permissions. The panel SHALL use existing MessageSystem room grants and TerminalSystem terminal grants as the permission truth and SHALL NOT introduce Shell-local membership or permission state.

#### Scenario: Avatar panel opens from Room composer

- **GIVEN** cli-shell is attached to a Shell-bound Terminal/Room pair
- **WHEN** the operator types or invokes `/avatar` from the Room composer
- **THEN** cli-shell opens an OpenTUI panel in the composer command area
- **AND** leaving the panel returns focus to the normal Room composer
- **AND** no entry-navigation state is involved

#### Scenario: Avatar add uses system grants

- **GIVEN** the active Shell binding has a bound Room and Terminal
- **AND** the operator selects an Avatar from the Avatar catalog in the `/avatar` panel
- **WHEN** the operator confirms add
- **THEN** cli-shell issues or refreshes the MessageSystem room grant for that Avatar actor
- **AND** it issues or refreshes the TerminalSystem terminal grant according to the selected permission profile
- **AND** the Room people projection can display that Avatar on the next refresh

#### Scenario: Avatar remove revokes binding access only

- **GIVEN** an Avatar has grants for the active Shell binding's Room or Terminal
- **WHEN** the operator removes that Avatar from the `/avatar` panel
- **THEN** cli-shell revokes that Avatar's grants for the active Room and Terminal as applicable
- **AND** it does not delete the Avatar catalog entry, Avatar principal, AvatarRuntime session history, or unrelated grants in other Rooms or Terminals

#### Scenario: Avatar permission config maps to existing roles

- **GIVEN** the operator edits an Avatar in the `/avatar` panel
- **WHEN** the operator changes Room permission or Terminal permission
- **THEN** Room permission is represented through MessageSystem grant roles such as `admin`, `member`, or `readonly`
- **AND** Terminal permission is represented through TerminalSystem grant roles such as `admin`, `writer`, `guard`, or `readonly`
- **AND** the panel stores no separate Shell-local permission bitset

### Requirement: Cli-shell SHALL drop unsupported legacy binding compatibility

Cli-shell SHALL only direct-enter canonical Shell bindings that match the current Terminal/Room binding law. It SHALL NOT preserve hidden compatibility for legacy ambiguous bindings, stale `shell-N:terminal-M` resource keys, or bindings that cannot be represented as one normalized Shell resource key with one Terminal and one Room. Unsupported legacy rows MAY be omitted from Select Terminal or displayed as unavailable, but they SHALL NOT trigger repair, migration, or Avatar inference during entry.

#### Scenario: Unsupported legacy binding is not auto-repaired

- **GIVEN** a legacy Shell-bound resource uses an unsupported or ambiguous resource key
- **WHEN** cli-shell builds or confirms the Select Terminal model
- **THEN** cli-shell does not migrate, repair, or reinterpret that resource as the active binding
- **AND** it does not select an Avatar from historical participants
- **AND** it does not issue TerminalSystem or MessageSystem grants as a compatibility side effect

#### Scenario: Canonical binding remains selectable

- **GIVEN** a Shell-bound Terminal and Room both use the same normalized canonical resource key such as `shell-7`
- **WHEN** cli-shell builds the Select Terminal panel
- **THEN** the binding remains eligible for direct entry
- **AND** unsupported legacy resources do not affect that row's identity
