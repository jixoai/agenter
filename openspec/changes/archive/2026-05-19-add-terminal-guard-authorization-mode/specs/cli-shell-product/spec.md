## ADDED Requirements

### Requirement: Cli-shell SHALL default Shell Assistant terminal authority to Guard

Cli-shell SHALL grant the selected Shell Assistant guard terminal authority by default for the shell-truth and visible app terminals. Guard authority allows observation and approval-gated writes. Cli-shell managed/takeover SHALL be app-owned hosting attention state and SHALL NOT grant or imply terminal write authority.

#### Scenario: Default launch grants Guard terminal authority
- **WHEN** a user runs `agenter shell`
- **THEN** cli-shell grants the selected Shell Assistant `guard` terminal access to the bound terminal resources
- **THEN** cli-shell does not grant direct writer authority only because the Avatar is the default shell assistant

#### Scenario: Guard write creates approval work in the current terminal
- **WHEN** Shell Assistant attempts to write the current cli-shell TerminalSystem instance without an active write lease
- **THEN** the terminal write creates a guard approval request
- **THEN** cli-shell treats that request as pending work for the current terminal
- **THEN** cli-shell does not route the equivalent command through root/workspace bash as a substitute for the visible terminal action

#### Scenario: Approved Guard work resumes in terminal-1 and returns through terminal-2
- **WHEN** Shell Assistant requests a guarded write for the current cli-shell terminal and an admin approves it
- **THEN** Shell Assistant continues the work by writing through TerminalSystem under the approved lease
- **THEN** terminal-1 remains the shell truth that receives the PTY input
- **THEN** terminal-2 remains the visible app-terminal surface that can later publish the shell result
- **THEN** Shell Assistant reports completion in the bound MessageRoom only after observing the terminal result

#### Scenario: Denied or expired approval remains a terminal-local outcome
- **WHEN** a cli-shell guard approval request is denied or expires
- **THEN** cli-shell treats the requested terminal input as not performed
- **THEN** Shell Assistant may report the denial or expiry in the current MessageRoom
- **THEN** Shell Assistant does not execute the same requested terminal action through root/workspace bash as a substitute

#### Scenario: Managed mode commits hosting attention only
- **WHEN** the user enables cli-shell managed/takeover mode
- **THEN** cli-shell commits or updates the room-bound hosting attention item for the current shell
- **THEN** cli-shell does not create a app write delegation, terminal write lease, permanent writer grant, or TerminalSystem-owned managed flag
- **THEN** Shell Assistant writes still follow its existing TerminalSystem authority

#### Scenario: Managed off settles hosting attention only
- **WHEN** the user disables cli-shell managed/takeover mode
- **THEN** cli-shell commits or settles the room-bound hosting attention item for the current shell
- **THEN** cli-shell does not revoke unrelated terminal grants, room grants, or write leases that were created by ordinary TerminalSystem approval
- **THEN** visible managed labels update from the hosting attention projection rather than from terminal metadata truth

#### Scenario: Managed state does not require active delegation
- **GIVEN** cli-shell has positive hosting attention for the current shell
- **WHEN** no app delegation record exists
- **THEN** cli-shell still reports managed/takeover as active from hosting attention
- **THEN** Shell Assistant terminal writes still follow TerminalSystem guard/writer/lease authority

#### Scenario: Composed terminal publication is app-rendered frame only
- **WHEN** cli-shell publishes terminal-2 composed output to TerminalSystem
- **THEN** cli-shell has already rendered toolbar, chat/dialogue, managed label, unread label, and heartbeat text into generic terminal frame lines or rich lines
- **THEN** TerminalSystem receives only generic composed terminal frame data and app-opaque metadata
- **THEN** TerminalSystem does not receive or persist cli-shell-specific fields such as `managedLabel`, `dialogueDraft`, or `toolbarManaged`

#### Scenario: Native shell terminal view shows guard permission overlay
- **WHEN** Shell Assistant creates a guard permission request for the cli-shell bound terminal
- **THEN** cli-shell observes the request through a terminal-id filtered TerminalSystem subscription
- **THEN** `shell-terminal-view` renders a default OpenTUI TopLayer approval overlay unless app code handles the request through its callback
- **THEN** the overlay does not mutate terminal scrollback, selection truth, shell truth, or managed/takeover state

#### Scenario: Cli-shell approval overlay acts through TerminalSystem
- **WHEN** the user approves or denies from the native TopLayer overlay
- **THEN** cli-shell calls the TerminalSystem approval or denial command
- **THEN** approval mints terminal-native write authority for that request
- **THEN** cli-shell does not create app delegation or local writer state

#### Scenario: Repeated guard requests update one cli-shell overlay
- **WHEN** Shell Assistant repeats an equivalent guarded write while the first request is still pending
- **THEN** cli-shell receives the refreshed or reused TerminalSystem request
- **THEN** the native TopLayer approval overlay updates the existing request instead of stacking duplicate overlays

#### Scenario: Cli-shell boundary comments protect future products
- **WHEN** the cli-shell managed/takeover implementation is updated
- **THEN** the code includes a short boundary comment that managed/takeover is cli-shell app attention state
- **THEN** the comment states that terminal write authority belongs to TerminalSystem and must not be created by managed/takeover
- **THEN** future app authors can reuse the platform without inheriting cli-shell-specific authority law

### Requirement: Cli-shell SHALL clean stale app resources through generic APIs

Cli-shell SHALL provide a app-local cleanup command for stale cli-shell terminal, MessageRoom, and shell-assistant session resources. Cleanup SHALL use existing session, message-system, and TerminalSystem APIs and SHALL NOT require core to learn cli-shell-specific deletion semantics.

#### Scenario: Cleanup dry-run is non-destructive
- **WHEN** the user runs `agenter shell cleanup`
- **THEN** cli-shell lists app-bound terminal ids, MessageRoom ids, and shell-assistant session ids
- **THEN** it does not delete those resources

#### Scenario: Confirmed cleanup removes rooms sessions and terminals
- **WHEN** the user runs `agenter shell cleanup --confirm`
- **THEN** cli-shell deletes app-bound MessageRooms and shell-assistant sessions before deleting TerminalSystem instances
- **THEN** resources outside cli-shell app metadata are not deleted

#### Scenario: Cleanup can be scoped to one shell name
- **WHEN** the user runs `agenter shell cleanup --session=2 --confirm`
- **THEN** cli-shell targets the app resource key `shell-2`
- **THEN** other cli-shell shell names remain outside that cleanup operation
