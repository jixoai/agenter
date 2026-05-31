## ADDED Requirements

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
