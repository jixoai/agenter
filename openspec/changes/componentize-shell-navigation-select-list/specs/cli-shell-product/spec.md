## ADDED Requirements

### Requirement: Cli-shell OpenTUI navigation lists SHALL centralize list physics

Cli-shell SHALL express reusable startup-list mechanics through an app-owned OpenTUI component or primitive instead of embedding them directly in entry-flow business code. The primitive SHALL own multi-line item layout, item-based selection movement, visible-window calculation, hit-region generation, and mousedown-select / release-confirm pointer behavior. It SHALL accept display rows and callbacks as inputs and SHALL NOT own TerminalSystem, MessageSystem, AvatarRuntime, grant, or auth truth.

#### Scenario: Multi-line list selection remains item-based

- **GIVEN** a selectable Terminal row wraps into multiple visual lines
- **WHEN** the operator presses Up or Down
- **THEN** cli-shell moves selection by one logical item
- **AND** the visible-window calculation keeps the selected logical item reachable even when it occupies multiple visual lines

#### Scenario: Pointer confirmation is owned by the list primitive

- **GIVEN** an item has a generated hit region covering one or more visual lines
- **WHEN** the operator presses the left mouse button inside that region
- **THEN** the list primitive selects that logical item
- **WHEN** the operator releases the left mouse button inside the same logical item
- **THEN** the list primitive invokes the item confirmation callback
- **AND** entry-flow business code does not duplicate hit-region math for this behavior

### Requirement: Cli-shell OpenTUI hit regions SHALL use explicit screen projection

Cli-shell SHALL convert renderable-local geometry into screen-coordinate hit regions through a shared projection primitive. The primitive SHALL make border/content inset explicit so a bordered parent cannot silently shift click targets away from the visible rows. Business surfaces MAY choose their parent inset, but they SHALL NOT hand-write the same border offset arithmetic at each use site.

#### Scenario: Bordered parent coordinates match visible rows

- **GIVEN** a selectable row is rendered inside a bordered OpenTUI parent
- **WHEN** the operator clicks the row at its visible screen position
- **THEN** the generated hit region resolves that click to the intended logical item
- **AND** the row is not offset by the parent's border in one coordinate space but not the other

## MODIFIED Requirements

### Requirement: Cli-shell Select Terminal rows SHALL expose structured fields

The Select Terminal panel SHALL render existing Terminal rows from structured fields rather than a single flattened label. Existing live Terminal rows SHALL expose exactly these display roles in order: `id`, `pwd`, `pty-title`, and `room-users`. The panel SHALL NOT display a redundant `running` field for existing rows because the list is already restricted to live terminals. The renderer SHALL visually distinguish the display roles with separate color/style tokens while keeping the row compact enough for the OpenTUI startup panel.

#### Scenario: Row fields remain distinguishable

- **GIVEN** a Shell-bound Terminal has id `shell-7`, current path `/repo`, pty title `dev`, and Room users `@AAA, @BBB`
- **WHEN** the Select Terminal panel renders that row
- **THEN** the row presents those facts as separate `id`, `pwd`, `pty-title`, and `room-users` fields in that order
- **AND** the row does not display `running`
- **AND** the fields use different visual roles instead of one undifferentiated text color

#### Scenario: Row truncation preserves field identity

- **GIVEN** the terminal width is too small to display every field in full
- **WHEN** the Select Terminal panel renders existing rows
- **THEN** the renderer measures display width with Bun `stringWidth`
- **AND** it wraps only between fields
- **AND** each individual field stays on one visual line
- **AND** an over-wide individual field is clipped to an ellipsis form such as `XXX...`
- **AND** it does not merge room-users into the pty title, pwd, or id

### Requirement: Cli-shell rows SHALL show other Room people

For each existing Terminal row with a bound Room, cli-shell SHALL derive a display-only people projection from the bound Room's participant/grant facts and render other visible room participants as comma-separated mention tokens such as `@AAA, @BBB`. The projection MUST exclude the current superadmin control identity by canonical auth/contact/actor identity, not by display-label guessing. The people projection SHALL NOT become membership truth.

#### Scenario: Current superadmin is excluded from mentions

- **GIVEN** the current authenticated operator is superadmin actor `auth:root`
- **AND** the bound Room includes participants for `auth:root`, Avatar `AAA`, and Avatar `BBB`
- **WHEN** cli-shell renders the Select Terminal row for that Room
- **THEN** the people field displays `@AAA, @BBB`
- **AND** it does not display `@root` or another token for the current superadmin control actor

#### Scenario: Mention labels are display projection only

- **GIVEN** a Room participant has a resolved label
- **WHEN** cli-shell renders the people field
- **THEN** the mention token may use that label for display
- **AND** the underlying participant id remains the canonical room actor id
- **AND** changing the rendered token does not mutate Room participants or grants
