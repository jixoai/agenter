## MODIFIED Requirements

### Requirement: Terminal control plane SHALL publish live permission request events

The terminal control plane SHALL publish live permission request events for guard writes that need approval. These events SHALL be filterable by terminal id so global app surfaces can subscribe to all requests while terminal-view components subscribe only to the terminal they render. Pending permission requests SHALL be bound to the live TerminalInstance that created them and SHALL NOT become restartable write authority after terminal kill/rebootstrap.

#### Scenario: Guard write emits a terminal-scoped permission event

- **WHEN** actor `P` with `guard` authority attempts to write terminal `T` without an active write lease
- **THEN** TerminalSystem creates a pending permission request for live terminal instance `T`
- **THEN** it emits a permission request event containing terminal id, request id, actor, requested input mode/preview, status, created time, and expiry
- **THEN** no bytes are written to the PTY before approval

#### Scenario: Subscription supports all-terminal and terminal-scoped filters

- **WHEN** a client subscribes with no `terminalId` filter
- **THEN** it receives permission request events for all terminals the caller is allowed to observe
- **WHEN** a client subscribes with `terminalId=T`
- **THEN** it receives only permission request events for terminal `T`

#### Scenario: Subscription visibility is enforced before delivery

- **WHEN** a caller subscribes globally or with `terminalId=T`
- **THEN** TerminalSystem filters events by the caller's terminal observation authority before sending them
- **THEN** clients are not expected to hide unauthorized permission request previews after over-receiving them
- **THEN** a caller without read authority for terminal `T` receives no permission request event for `T`

#### Scenario: Terminal rebootstrap clears executable pending request state

- **WHEN** terminal `T` dies or is killed and later bootstrapped as a new live instance
- **THEN** unresolved permission requests from the previous live instance no longer authorize writes
- **THEN** durable history may still show those requests as expired, cancelled, or historical facts
- **THEN** approval of an old request cannot mint a write lease for the new terminal instance

#### Scenario: Permission subscription is observation only

- **WHEN** a subscriber receives a permission request event
- **THEN** the event itself does not approve, deny, or grant write authority
- **THEN** approval and denial still go through TerminalSystem authority commands

#### Scenario: Approval decision checks current request status

- **WHEN** an admin approves or denies a permission request
- **THEN** TerminalSystem verifies the request is still pending for the same live TerminalInstance
- **THEN** approved, denied, expired, cancelled, or stale requests cannot mint additional leases
- **THEN** the result records the decision without creating product-local authority state

### Requirement: Terminal seat management SHALL onboard shared principals through invitation acceptance

The terminal control plane SHALL let the current local admin or superadmin create, update, and revoke managed seat invitations for a target principal without issuing terminal authority until the target accepts. `terminal-manage invite` and `terminal-manage accept` SHALL be projections over these control-plane operations, not separate seat truth. Terminal managed seat authority SHALL include `RO`, `GUARD`, `RW`, and `TM`, where `GUARD` activates the terminal-native `guard` grant.

#### Scenario: Current local admin issues a terminal invitation

- **WHEN** the current local admin invites principal `P` to terminal `T` with terminal authority `RW`
- **THEN** the control plane records a pending terminal seat invitation for `T` and `P`
- **THEN** `P` does not yet receive a terminal access token or active terminal grant

#### Scenario: Current local admin issues a guarded terminal invitation

- **WHEN** the current local admin invites principal `P` to terminal `T` with terminal authority `GUARD`
- **THEN** the control plane records a pending terminal seat invitation for `T` and `P`
- **THEN** acceptance will activate a terminal-native `guard` grant rather than direct writer authority
- **THEN** `P` does not receive a terminal access token or active terminal grant before accepting the invitation

#### Scenario: Accepted writable terminal seat is direct-write rather than approval-only

- **WHEN** principal `P` successfully accepts a terminal invitation for `T` with class `RW`
- **THEN** the resulting terminal-native payload is the direct-write seat
- **THEN** `P` can operate the terminal immediately without entering guard approval

#### Scenario: Accepted guarded terminal seat uses approval path

- **WHEN** principal `P` successfully accepts a terminal invitation for `T` with class `GUARD`
- **THEN** the resulting terminal-native payload is the guard seat
- **THEN** `P` can read terminal state
- **THEN** `P` write attempts require approval or an active write lease before reaching the PTY

#### Scenario: Accepted terminal invitation activates the seat

- **WHEN** principal `P` successfully accepts its pending invitation for terminal `T`
- **THEN** the control plane creates or reuses the terminal-native grant for `P`
- **THEN** the acceptance returns `P`'s active terminal access projection including the terminal access token
- **THEN** subsequent terminal reads or writes for `P` follow the native terminal role law

#### Scenario: Invited writer can collaborate on the same terminal after room delivery

- **WHEN** current local admin `A` sends principal `B` a pending terminal invitation descriptor through messageSystem and `B` accepts it with terminal authority `RW`
- **THEN** `B` can read the same shared terminal `T`
- **THEN** `B` can write to `T` immediately without entering guard approval
- **THEN** subsequent reads by both `A` and `B` can observe the terminal state that results from `B`'s write under the native terminal read law

#### Scenario: Cross-agenter invite preserves remote terminal authority

- **WHEN** Avatar-B on agenter-B creates terminal `T`, sends Avatar-A a pending descriptor through a shared room, and Avatar-A accepts from agenter-A
- **THEN** terminal `T` remains owned by agenter-B's terminal backend
- **THEN** Avatar-A gains terminal-native authority on that remote terminal only after acceptance succeeds against agenter-B
- **THEN** reads and writes issued by Avatar-A from agenter-A still affect and observe the same terminal `T` hosted by agenter-B

#### Scenario: Terminal manager authority joins the admin-candidate law

- **WHEN** principal `P` accepts a terminal invitation with terminal authority `TM`
- **THEN** the resulting seat is resolved to the terminal-native admin payload
- **THEN** `P` is inserted into the terminal's admin-candidate set
- **THEN** current-admin resolution still follows the existing single-current-admin law instead of creating a second simultaneous current admin

### Requirement: Terminal seat mutation SHALL remain a manager containment power

Terminal `config` and `revoke` operations SHALL remain unilateral actions for the current local admin or superadmin. Reconfiguring an accepted seat SHALL update the terminal-native grant law in place, and revoking a seat SHALL also invalidate any pending invitations and active write leases for that principal.

#### Scenario: Config changes an accepted terminal seat to writer

- **WHEN** the current local admin changes principal `P` on terminal `T` from `RO` or `GUARD` to `RW`
- **THEN** the control plane updates `P`'s active terminal seat to the terminal-native direct-write payload
- **THEN** `P` does not need to accept a second invitation only because the role changed

#### Scenario: Config changes an accepted terminal seat to guard

- **WHEN** the current local admin changes principal `P` on terminal `T` from `RO` or `RW` to `GUARD`
- **THEN** the control plane updates `P`'s active terminal seat to the terminal-native guard payload
- **THEN** later writes by `P` require approval or an active write lease before reaching the PTY
- **THEN** `P` does not need to accept a second invitation only because the role changed

#### Scenario: Revoke removes active and pending terminal authority

- **WHEN** the current local admin revokes principal `P` from terminal `T`
- **THEN** any active terminal grant for `P` on `T` is revoked
- **THEN** any pending invitation for `P` on `T` becomes invalid
- **THEN** any active write lease for `P` on `T` no longer authorizes new writes

### Requirement: Composed terminal surfaces SHALL remain product-opaque terminal frames

The terminal control plane MAY accept composed terminal frame publications from an authorized publisher, but the composed surface contract SHALL be product-opaque. TerminalSystem SHALL store and transport generic terminal frame data, cursor, scrollback, and product-opaque metadata. It SHALL NOT model cli-shell toolbar state, managed/takeover labels, dialogue draft, heartbeat text, unread label, or localized strings such as `托管 off` as terminal-native fields or metadata defaults.

#### Scenario: Composed publication carries generic frame data

- **WHEN** an authorized product publishes a composed terminal frame
- **THEN** the control plane stores the frame lines, rich lines, cursor, scrollback, and generic frame metadata needed to reproduce the terminal screen
- **THEN** it does not require fields named after cli-shell UI state such as `managedLabel`, `dialogueDraft`, `unreadLabel`, or `heartbeatLabel`

#### Scenario: TerminalSystem does not default cli-shell labels

- **WHEN** a composed terminal is created before any product frame has been published
- **THEN** TerminalSystem may show a generic placeholder based on terminal id or title
- **THEN** it does not synthesize cli-shell text such as `托管 off`, toolbar separators, unread counters, or heartbeat messages

#### Scenario: Product chrome is rendered before crossing the TerminalSystem boundary

- **WHEN** cli-shell wants terminal-2 to display managed/takeover state, room unread count, heartbeat text, or dialogue draft
- **THEN** cli-shell renders those product facts into the terminal frame before publication
- **THEN** TerminalSystem treats the result as terminal frame content rather than structured cli-shell state

#### Scenario: Core comments document product opacity

- **WHEN** the composed surface type or publisher is implemented
- **THEN** a short code comment states that TerminalSystem accepts product-rendered frames and must not learn product chrome semantics
- **THEN** tests prevent reintroducing cli-shell-specific composed-surface fields into terminal-system public types
