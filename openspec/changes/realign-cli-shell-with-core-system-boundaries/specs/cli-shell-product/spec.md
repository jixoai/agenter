## MODIFIED Requirements

### Requirement: Cli-shell SHALL be a TUI projection over core systems

Cli-shell SHALL be an extension TUI product that binds and renders core-system resources. Shell truth SHALL remain in TerminalSystem, Room truth SHALL remain in MessageSystem, Avatar prompt truth SHALL remain in Core/AvatarRuntime prompt-source resolution, and authorization truth SHALL remain in TerminalSystem. cli-shell SHALL own only product grammar, local TUI layout, local process/container selection, and product lifecycle orchestration through generic SDK contracts.

#### Scenario: cli-shell start binds core resources
- **WHEN** a user runs `bun agenter shell --session=7 --avatar=bangeel`
- **THEN** cli-shell binds product resource key `shell-7`
- **AND** it obtains or ensures a TerminalSystem terminal for the shell surface through generic product binding
- **AND** it obtains or ensures a MessageSystem room for the MessageRoom surface through generic product binding
- **AND** it starts or selects the AvatarRuntime through generic runtime APIs
- **AND** it does not replace any of those identities with tmux pane ids as durable truth

#### Scenario: cli-shell does not restore terminal-2 product chrome
- **WHEN** cli-shell renders status, Chat, top layer, or layout controls
- **THEN** those UI elements remain product TUI projections
- **AND** TerminalSystem is not asked to store cli-shell chrome as a composed product terminal
- **AND** no `terminalRuntimeKind=composed`, `composedShellTerminalId`, or `ProductTerminalComposedSurfaceState` is required for active cli-shell runtime

#### Scenario: cli-shell does not make tmux the Shell truth
- **WHEN** cli-shell uses tmux as a local host or layout container
- **THEN** tmux pane ids remain presentation/process-host identities
- **AND** terminal read/write/await, approval, grant, lifecycle, and AI terminal observation continue to target the bound TerminalSystem terminal id

### Requirement: Cli-shell SHALL resolve current shell target from product binding

Cli-shell SHALL resolve the current shell target from the product binding created during bootstrap. It SHALL NOT ask the Avatar or TUI to infer the current shell by scanning global TerminalSystem catalogs or tmux pane lists.

#### Scenario: Fresh session ignores stale terminal residue
- **GIVEN** stale legacy resources such as `shell-4:terminal-2` or `shell-5:terminal-2` still exist
- **WHEN** cli-shell starts `--session=7 --avatar=bangeel`
- **THEN** the current shell target is the TerminalSystem terminal bound to `shell-7`
- **AND** stale resources are not selected as write targets
- **AND** Avatar-visible product context identifies the current bound terminal

#### Scenario: Re-entering a session restores the same binding
- **WHEN** a user exits and later re-enters `--session=6 --avatar=bangeel`
- **THEN** cli-shell restores or reuses the product binding for `shell-6`
- **AND** it does not report that there is no independent terminal merely because tmux state or old TerminalSystem residue disagrees

### Requirement: Cli-shell SHALL render MessageRoom and terminal approval as separate TUI surfaces over core facts

Cli-shell SHALL render MessageRoom as a MessageSystem surface and terminal approval as a TerminalSystem surface. Room MAY request a top-layer presentation when pending terminal approvals exist, but Room SHALL NOT own the approval request and the top layer SHALL NOT store approval truth locally.

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

Cli-shell managed/on/off SHALL be a product-scoped attention fact and a TUI projection. It SHALL NOT grant terminal authority, alter TerminalSystem mode, or become local tmux truth.

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

#### Scenario: tmux can be swapped without changing system truth
- **WHEN** cli-shell changes from tmux hosting to another TUI host
- **THEN** the bound TerminalSystem terminal id remains the shell truth
- **AND** the bound MessageSystem room id remains the room truth
- **AND** the selected AvatarRuntime and attention contexts remain unchanged
