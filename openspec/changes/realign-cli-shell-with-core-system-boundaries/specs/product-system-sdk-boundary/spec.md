## ADDED Requirements

### Requirement: Product TUIs SHALL consume core systems through generic SDK contracts

Product TUIs SHALL render and operate kernel-owned systems through generic SDK contracts. A product TUI MAY own local layout, presentation, key bindings, process hosting, and cleanup orchestration, but it SHALL NOT become the durable truth for TerminalSystem terminals, MessageSystem rooms, Avatar prompt sources, terminal authorization, or AttentionSystem facts.

#### Scenario: Product TUI renders a terminal without owning Shell truth
- **WHEN** a product TUI displays terminal output
- **THEN** the terminal content, cursor, lifecycle, read/write effects, and approval state come from TerminalSystem APIs
- **AND** the product TUI does not replace the terminal id with a local pane id as system truth
- **AND** local layout or frame caches remain presentation-only projections

#### Scenario: Product TUI renders a room without owning MessageRoom truth
- **WHEN** a product TUI displays chat or room messages
- **THEN** the transcript, participants, read state, and send/edit/recall effects come from MessageSystem APIs
- **AND** the product TUI does not store a second authoritative room transcript

#### Scenario: Product TUI uses Avatar context without owning prompt truth
- **WHEN** a product TUI starts or selects an AvatarRuntime
- **THEN** Avatar identity, prompt-source resolution, AGENTER.mdx composition, and prompt persistence remain Core/AvatarRuntime truth
- **AND** product context is supplied through generic runtime/session facts or attention projections
- **AND** the product does not overwrite user prompt files to force its current UI assumptions

#### Scenario: Product runtime facts do not become a second prompt source
- **WHEN** cli-shell exposes current terminal/room binding to the Avatar
- **THEN** those facts are modeled as runtime/session facts or equivalent typed projections
- **AND** `AGENTER.mdx` remains the single trusted prompt source
- **AND** the product does not inject a second hidden prompt file or product-only prompt layer

#### Scenario: Product TUI renders authorization without owning authorization truth
- **WHEN** a product TUI displays an approval popup or permission control
- **THEN** the pending request, approve/deny mutation, lease, grant, and write authority are TerminalSystem truth
- **AND** the product TUI owns only presentation, focus, and user interaction

#### Scenario: Product TUI projects attention without owning scheduler truth
- **WHEN** a product TUI shows managed state, heartbeat, watch state, or progress
- **THEN** durable obligations and scheduling pressure remain AttentionSystem truth
- **AND** product-local booleans or status labels are projections over attention facts

### Requirement: Product SDK surfaces SHALL be core-noun based and reusable

SDK APIs exposed for product TUIs SHALL be named and typed around core-system resources rather than around one product's UI layout. New product needs SHALL add generic terminal, room, avatar, runtime, attention, or lifecycle capabilities before product-specific implementation shortcuts are allowed.

#### Scenario: Terminal operation is exposed as terminal capability
- **WHEN** cli-shell or another product needs to write to a visible shell
- **THEN** it calls a generic terminal write/input API with a TerminalSystem terminal id and actor authority
- **AND** it does not call a cli-shell-only core method such as `writeCliShellPane`

#### Scenario: Room operation is exposed as room capability
- **WHEN** a product needs to send a message from its UI
- **THEN** it calls a generic MessageSystem send API with a room id and actor context
- **AND** it does not write directly into a product-local message database

#### Scenario: Transport optimizations preserve semantic boundaries
- **WHEN** the SDK adds WebSocket, process IPC, shared memory, or same-process direct data-plane transport
- **THEN** the transported messages preserve the same terminal/room/avatar/attention semantics
- **AND** the optimization does not create a second source of truth

### Requirement: Product resource binding SHALL return current core-resource identities

Product resource binding SHALL produce enough typed identity for a TUI to render and operate the current product session without rediscovering stale global resources. At minimum the binding output SHALL identify the product resource key, TerminalSystem terminal id when the product has a shell surface, MessageSystem room id when the product has a room, selected AvatarRuntime session/principal, and relevant attention context ids.

#### Scenario: cli-shell binding exposes current terminal and room
- **WHEN** cli-shell starts `--session=7 --avatar=bangeel`
- **THEN** product binding returns the current TerminalSystem terminal id for `shell-7`
- **AND** it returns the current MessageSystem room id for `shell-7`
- **AND** it returns the selected AvatarRuntime identity
- **AND** cli-shell does not need to infer the current terminal by scanning stale `terminal list` output

#### Scenario: Stale residue is not a current binding
- **GIVEN** old cli-shell terminals such as `shell-4:terminal-2` remain in TerminalSystem history
- **WHEN** cli-shell starts `--session=7`
- **THEN** the product binding identifies only the current `shell-7` resources
- **AND** stale resources are not treated as current targets merely because they appear in the global catalog

### Requirement: Product cleanup SHALL target bound resources without being runtime truth

Product cleanup SHALL use generic lifecycle and resource APIs to remove product-owned resources. Cleanup MAY remove stale historical residue as a migration action, but active runtime behavior SHALL NOT depend on cleanup having removed old resources.

#### Scenario: Cleanup removes product resources through owners
- **WHEN** cli-shell cleanup runs for a session
- **THEN** TerminalSystem resources are stopped/deleted through TerminalSystem APIs
- **AND** MessageRoom resources are removed through MessageSystem APIs
- **AND** Avatar runtime sessions are cleared through runtime APIs
- **AND** local presentation hosts such as tmux are killed only as local process cleanup

#### Scenario: Fresh session is correct before cleanup
- **GIVEN** stale cli-shell residue exists from previous implementations
- **WHEN** a fresh cli-shell session starts
- **THEN** it still binds the correct current TerminalSystem terminal and MessageSystem room
- **AND** it does not require manual cleanup before the Avatar can target the current shell
