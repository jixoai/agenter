## Purpose

Define the canonical control plane for global terminal lifecycle, focus, inspection, and operating-system execution guidance.
## Requirements
### Requirement: Terminal focus SHALL be managed as a declarative focus set

The global terminal control plane SHALL manage focused terminals through a declarative `terminal_focus` operation that supports `add`, `remove`, `replace`, and `clear` semantics over globally durable terminal ids, and it SHALL preserve actor-scoped focus or presence state without requiring terminal ownership to match a single session runtime.

#### Scenario: Clear the focus set for an attached actor
- **WHEN** a caller invokes terminal focus with `op = clear`
- **THEN** that caller's focused-terminal set becomes empty
- **THEN** later attention or UI rules can distinguish between "no focused terminal" and "one or more focused terminals"

#### Scenario: Focus does not transfer terminal ownership to a session
- **WHEN** a session actor focuses an existing global terminal
- **THEN** the terminal remains part of the global terminal catalog
- **THEN** stopping that session does not delete the terminal or its durable grants

#### Scenario: Focused terminals feed the attention-source pipeline
- **WHEN** the focused-terminal set includes one or more running terminals
- **THEN** semantic changes from those terminals are eligible for terminal-source invalidation into LoopBus attention ingestion
- **THEN** unfocused terminals do not bypass the source adapter path to trigger model work directly

#### Scenario: Focused terminal observations default to passive history
- **WHEN** focused terminal output is persisted into the attention source pipeline for inspection
- **THEN** that output remains queryable in terminal attention history
- **AND** it does not automatically become unresolved debt unless the terminal event is explicitly modeled as actionable

### Requirement: Terminal inspection SHALL prefer read and snapshot primitives

The terminal control plane SHALL expose `terminal_read` and `terminal_snapshot` as the primary inspection primitives, and those primitives SHALL inspect existing runtime truth without mutating lifecycle.

#### Scenario: Read explicitly forces snapshot
- **WHEN** a caller invokes `terminal_read` with `mode = snapshot`
- **THEN** the runtime returns the same full representation contract as `terminal_snapshot`
- **THEN** the payload still declares that the returned representation is a snapshot

#### Scenario: Snapshot returns full renderable terminal state
- **WHEN** a caller invokes `terminal_snapshot` for a running terminal with scrollback beyond the viewport
- **THEN** the payload includes the full renderable snapshot contract needed to hydrate a terminal viewport
- **THEN** the payload is not reduced to a tail-only excerpt

#### Scenario: Inspection does not auto-start a stopped terminal

- **WHEN** a caller invokes `terminal_read` or `terminal_snapshot` for a `not_started` or `stopped` terminal
- **THEN** the control plane returns a terminal-not-running style failure
- **AND** the inspection path does not implicitly bootstrap the terminal process

#### Scenario: Inspection does not create hidden bootstrap access
- **WHEN** a caller performs a read-only inspection path
- **THEN** the control plane does not create or refresh a trusted bootstrap grant as a side effect
- **THEN** catalog access state changes only through explicit grant or lifecycle operations

### Requirement: Terminal read cursors SHALL be actor-scoped

Terminal output SHALL remain a shared physical fact, but git-log/diff read progress SHALL be owned by the reading actor. A consuming terminal read MUST advance only that actor's read cursor and MUST NOT consume output for other actors or terminal seats.

#### Scenario: Two actors consume the same diff independently
- **WHEN** two actors share one git-log backed terminal and both have read access
- **AND** one actor consumes a terminal diff
- **THEN** the other actor can still consume that same diff from their own read cursor
- **AND** the first actor's next read starts from the cursor advanced by their own consuming read

#### Scenario: Seat tokens resolve the reader actor
- **WHEN** a caller reads a terminal through a terminal access token
- **THEN** the read cursor is keyed by the token grant's participant actor
- **AND** a token-backed read does not fall back to a terminal-global cursor

#### Scenario: Non-consuming inspection preserves read progress
- **WHEN** a caller reads a terminal with `remark = false`
- **THEN** the returned payload may describe the actor's current read cursor
- **AND** the durable read cursor for that actor is not advanced

### Requirement: App-bound terminals SHALL request git-backed history

App/global terminal creation paths that are intended to participate in runtime attention SHALL create git-log backed terminals by default. This is the durable terminal truth required by the idle unread bridge; app bindings MUST NOT rely on hand-built test profiles to enable terminal history.

#### Scenario: App terminal binding requests git-backed history

- **GIVEN** Shell creates a app global terminal binding
- **WHEN** it asks TerminalSystem to create that terminal
- **THEN** the terminal creation request includes `gitLog: "normal"`

#### Scenario: Daemon global terminals default to git-backed history

- **GIVEN** a app or admin path creates a global terminal without an explicit `gitLog` profile
- **WHEN** the daemon AppKernel provisions the shared TerminalControlPlane
- **THEN** the created terminal still has git-backed history available for read cursor comparison

### Requirement: Terminal control plane SHALL own terminal lifecycle operations
The terminal control plane SHALL expose lifecycle operations for listing, creating, bootstrapping, stopping, archiving, and deleting globally durable terminal instances through one canonical API family independent of session startup order. Terminal death and terminal deletion are distinct operations with distinct durable outcomes, and default listing SHALL expose only live actionable instances.

#### Scenario: Create a global shell terminal without first booting a session
- **WHEN** an authorized caller invokes terminal create without an explicit process descriptor
- **THEN** the control plane creates a terminal using the default shell profile in the global terminal catalog
- **THEN** the response returns the terminal id and applied process profile metadata

#### Scenario: Stop removes the instance from the live projection
- **WHEN** a caller with sufficient rights invokes terminal stop for an existing running terminal id
- **THEN** the PTY is stopped through the shared killed flow without deleting the durable terminal-instance evidence
- **THEN** later default live reads no longer resolve that terminal id as a live terminal
- **AND** later history reads can still resolve that terminal id until archive or delete occurs

#### Scenario: Delete removes the terminal catalog entry
- **WHEN** an authorized caller deletes a terminal
- **THEN** the terminal is removed from the durable terminal-instance catalog and remaining retained evidence according to terminal-system delete policy
- **AND** later live, history, and archive reads for that terminal id fail with a terminal-not-found style error

#### Scenario: Bootstrap is explicit
- **WHEN** a terminal is `not_started`
- **THEN** the PTY only starts after an explicit bootstrap lifecycle operation
- **AND** listing or opening the route does not implicitly start it

#### Scenario: Archive hides history without deleting evidence
- **WHEN** an authorized caller archives a killed terminal instance
- **THEN** the instance leaves the default history projection
- **AND** its durable evidence remains queryable through explicit archive-aware inspection until delete occurs

### Requirement: Terminal automation input SHALL respect explicit lifecycle boundaries

Automation-facing terminal input SHALL target already-running PTYs only. The write/input path MUST NOT bootstrap a stopped terminal as a side effect.

#### Scenario: Write does not auto-start a stopped terminal

- **WHEN** a caller invokes terminal write or terminal input for a `not_started` or `stopped` terminal
- **THEN** the call fails with a lifecycle-not-running style error
- **AND** the PTY remains stopped until an explicit bootstrap occurs

### Requirement: Terminal control plane SHALL separate durable lifecycle from transient lifecycle transition truth

The terminal control plane SHALL keep durable `processPhase` and transient `lifecycleTransition` as separate facts. `lifecycleTransition` exists only to coordinate in-flight lifecycle mutations such as bootstrap and kill/stop, and MUST NOT replace the durable lifecycle contract.

#### Scenario: Create auto-bootstrap exposes a transient bootstrapping phase

- **WHEN** an authorized caller creates a terminal through the default public create flow
- **THEN** the terminal may briefly expose `lifecycleTransition = bootstrapping`
- **AND** once the start completes it exposes `processPhase = running`
- **AND** `lifecycleTransition` returns to `null`

#### Scenario: Stop exposes a transient killing phase before stopped

- **WHEN** an authorized caller stops a running terminal PTY
- **THEN** the terminal exposes `lifecycleTransition = killing` while the PTY shutdown is in flight
- **AND** once shutdown completes it exposes `processPhase = stopped`
- **AND** `lifecycleTransition` returns to `null`

#### Scenario: Conflicting lifecycle mutations are rejected during a transition

- **WHEN** one caller has already started a bootstrap or kill/stop mutation for a terminal
- **THEN** a second conflicting lifecycle mutation for that same terminal is rejected with a clear transition-in-progress style error
- **AND** the control plane does not run overlapping lifecycle mutations for the same durable terminal id

### Requirement: Terminal control plane SHALL expose durable config inspection and mutation

The terminal control plane SHALL expose canonical config read/write operations for durable terminal launch truth after creation.

#### Scenario: Get-config returns durable launch truth separately from runtime observations

- **WHEN** a caller requests terminal config for an existing terminal
- **THEN** the result includes durable launch truth such as `command`, `launchCwd`, `processKind`, profile fields, and metadata
- **AND** it may include `processPhase` and `lifecycleTransition` as lifecycle summary fields
- **AND** it does not replace durable config fields with runtime-observed `currentPath` or `currentTitle`

#### Scenario: Set-config updates next-bootstrap launch truth

- **WHEN** a caller updates terminal config such as default launch cwd, command, title, or metadata
- **THEN** the durable terminal record is updated without changing the terminal id
- **AND** later bootstrap uses the updated durable launch truth

#### Scenario: Geometry config may apply live and durably

- **WHEN** a caller updates `cols` or `rows` for a running terminal
- **THEN** the durable terminal config is updated
- **AND** the running PTY geometry is resized to match

#### Scenario: Non-geometry launch changes do not rewrite the running process in place

- **WHEN** a caller updates launch fields such as `command`, `launchCwd`, or environment for a running terminal
- **THEN** the durable config is updated immediately
- **AND** the already-running PTY keeps its current process
- **AND** the updated launch fields take effect on the next bootstrap

### Requirement: Terminal control plane SHALL define operating-system execution semantics through skills and attention

The terminal control plane SHALL express terminal-side obligations through durable terminal facts and attention items, and the owning terminal skill guidance SHALL describe terminal as the assistant's operating-system workbench. That guidance SHALL prioritize terminal-backed inspection and execution when work depends on external facts, commands, files, processes, or network state.

#### Scenario: Terminal skill prefers terminal for external facts
- **WHEN** model work requires network, filesystem, process, command, or operating-system facts
- **THEN** the terminal skill directs the assistant to use terminal-backed execution before answering
- **AND** unverified external facts are not treated as completed work

#### Scenario: Terminal skill allows tool composition through terminal
- **WHEN** the available shell commands are insufficient for the task
- **THEN** the terminal skill allows the assistant to combine commands or author temporary scripts through terminal tools
- **AND** terminal failure can be escalated through other systems instead of fabricated answers

### Requirement: Terminal approval history SHALL expose durable state transitions

The terminal control plane SHALL retain approval requests across `pending`, `approved`, `denied`, and `expired` states, and approval queries MUST filter over durable approval history rather than a pending-only view.

#### Scenario: Query approved requests
- **WHEN** a pending approval request is approved for a terminal
- **THEN** `listApprovalRequests(statuses=["approved"])` returns that request
- **THEN** `listApprovalRequests(statuses=["pending"])` no longer returns it

#### Scenario: Query denied requests
- **WHEN** a pending approval request is denied for a terminal
- **THEN** `listApprovalRequests(statuses=["denied"])` returns that request
- **THEN** operators can inspect the historical denial without reconstructing it from leases or events

### Requirement: Terminal observation activity SHALL be caller controlled

Terminal read cursor consumption and terminal activity recording are separate controls. Cursor consumption SHALL be controlled by `remark`; activity records for reads SHALL be controlled by `recordActivity`.

#### Scenario: Pure inspection does not record activity
- **WHEN** a caller reads a terminal snapshot with activity recording disabled
- **THEN** no `terminal_read` activity event is appended
- **THEN** the terminal's activity history remains unchanged

#### Scenario: Explicit observation records activity
- **WHEN** a caller reads a terminal with activity recording enabled
- **THEN** a `terminal_read` activity event is appended
- **THEN** the appended event preserves the chosen representation metadata

### Requirement: Terminal control plane SHALL expose cancellation-safe await observation

The terminal control plane SHALL expose a `terminal_await` operation that waits for a bounded terminal physical-state condition and returns structured observation evidence. The operation MUST use TerminalSystem-owned facts such as headless snapshots, status, running state, and commit cursors; it MUST NOT hardcode business-specific or model-specific terminal semantics.

#### Scenario: Await changed output resolves from terminal commit truth
- **WHEN** an authorized caller awaits a running terminal with `until = changed` and a `fromHash` or equivalent cursor
- **THEN** the control plane resolves when terminal snapshot truth advances beyond that cursor
- **AND** the result identifies the observed cursor movement without requiring the caller to run `sleep`

#### Scenario: Await releases resources when cancelled
- **WHEN** a caller, transport, shell process, or runtime abort signal cancels an in-flight terminal await
- **THEN** every waiter, status listener, snapshot listener, timer, and fallback poll handle created for that await is released
- **AND** later terminal changes do not resolve or retain the cancelled await

#### Scenario: Await stopped terminal resolves as stopped evidence
- **WHEN** a terminal stops while a caller is awaiting a condition on that terminal
- **THEN** the await resolves or rejects through a terminal-stopped outcome that preserves the last available terminal evidence
- **AND** it does not leave a pending waiter attached to the stopped terminal

### Requirement: Terminal await SHALL evaluate deterministic conditions over clean stable snapshots

Terminal await conditions SHALL be evaluated against stable plain-text snapshot lines derived from the existing headless terminal state. The operation MUST NOT match against raw PTY bytes or ANSI transition chunks.

#### Scenario: Match evaluates stable snapshot lines
- **WHEN** a caller awaits with a `match.pattern`
- **THEN** the control plane waits for the configured stabilization window before evaluating the pattern
- **AND** matching is performed against clean snapshot text generated from the terminal canvas
- **AND** the result includes evidence for the matched line or text span

#### Scenario: Absent evaluates the stable snapshot state
- **WHEN** a caller awaits with `until = absent` and a `match.pattern`
- **THEN** the control plane resolves only after the stable snapshot does not contain that pattern
- **AND** the result states that the condition was evaluated against the final stable snapshot rather than an append-only log stream

#### Scenario: Timeout returns last observed evidence
- **WHEN** a terminal await reaches its command-level `timeoutMs`
- **THEN** the control plane returns a timeout outcome
- **AND** the result includes the last snapshot evidence available before timeout
- **AND** the control plane cleans up all internal wait resources for that await

### Requirement: Terminal observation activity SHALL be explicit

Terminal inspection MUST NOT append activity history by default. Activity records for reads SHALL only be written when the caller explicitly opts into observation recording.

#### Scenario: Pure inspection preserves lifecycle neutrality

- **WHEN** a caller reads a stopped terminal without observation recording
- **THEN** no activity event is appended
- **AND** the terminal lifecycle remains unchanged

### Requirement: Terminal seat management SHALL onboard shared principals through invitation acceptance

The terminal control plane SHALL let the current local admin or superadmin create, update, and revoke managed seat invitations for a target principal without issuing terminal authority until the target accepts. `terminal-manage invite` and `terminal-manage accept` SHALL be projections over these control-plane operations, not separate seat truth.

#### Scenario: Current local admin issues a terminal invitation

- **WHEN** the current local admin invites principal `P` to terminal `T` with terminal authority `RW`
- **THEN** the control plane records a pending terminal seat invitation for `T` and `P`
- **THEN** `P` does not yet receive a terminal access token or active terminal grant

#### Scenario: Accepted writable terminal seat is direct-write rather than approval-only

- **WHEN** principal `P` successfully accepts a terminal invitation for `T` with class `RW`
- **THEN** the resulting terminal-native payload is the direct-write seat
- **THEN** `P` can operate the terminal immediately without entering the guard approval path

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

#### Scenario: Config changes an accepted terminal seat

- **WHEN** the current local admin changes principal `P` on terminal `T` from `RO` to `RW`
- **THEN** the control plane updates `P`'s active terminal seat to the terminal-native direct-write payload
- **THEN** `P` does not need to accept a second invitation only because the role changed

#### Scenario: Revoke removes active and pending terminal authority

- **WHEN** the current local admin revokes principal `P` from terminal `T`
- **THEN** any active terminal grant for `P` on `T` is revoked
- **THEN** any pending invitation for `P` on `T` becomes invalid
- **THEN** any active write lease for `P` on `T` no longer authorizes new writes

### Requirement: Terminal instance history projection SHALL separate live terminals from dead evidence
The terminal control plane SHALL treat terminal instances as one durable record family with explicit projection boundaries. Default live listing and live lookup SHALL return only actionable live instances, while dead instances SHALL remain available only through explicit history or archive queries.

#### Scenario: Live list excludes killed terminal instances
- **WHEN** a terminal instance has completed the killed flow
- **THEN** the default terminal list does not return that terminal instance
- **AND** callers must use an explicit history-oriented query to inspect it

#### Scenario: History query returns killed instance evidence
- **WHEN** a caller queries terminal history for an instance that was previously killed
- **THEN** the control plane returns that terminal instance's durable lifecycle and transcript evidence
- **AND** the instance does not re-enter the live registry merely because it was inspected

#### Scenario: Archived instance requires explicit archive projection
- **WHEN** a terminal instance has been archived
- **THEN** default live and default history listings do not return it
- **AND** an explicit archive-aware query can still inspect it until final delete

### Requirement: Terminal death SHALL converge on one killed flow
The terminal control plane SHALL route explicit stop/kill, natural PTY exit, and daemon cold-start compensation through one authoritative killed flow. That flow SHALL own durable lifecycle mutation, live-registry removal, transient cleanup, and downstream invalidation.

#### Scenario: Explicit stop uses the killed flow
- **WHEN** an authorized caller stops a running terminal PTY
- **THEN** the control plane routes that terminal through the shared killed flow
- **AND** the terminal leaves the live registry when the flow completes

#### Scenario: Natural PTY exit uses the same killed flow
- **WHEN** a terminal PTY exits without an explicit operator stop
- **THEN** the control plane routes that terminal through the same shared killed flow
- **AND** downstream consumers observe the same lifecycle consequences as an explicit kill, with the exit reason preserved as evidence

#### Scenario: Daemon cold-start compensation replays the killed flow
- **WHEN** daemon startup detects a terminal row that was previously marked running but no longer has a live PTY
- **THEN** the control plane replays the shared killed flow for that terminal instance
- **AND** the system does not stop at a storage-only state rewrite

### Requirement: Terminal control plane SHALL expose live and history projections over one terminal instance truth

The terminal control plane SHALL expose live, history, archive, and all/index projections over the same durable `terminal_instance` records. Live projection SHALL exclude killed and archived instances. History projection SHALL include killed non-archived instances. Index projection SHALL include live instances first, then killed non-archived instances ordered by killed time descending. None of these projections SHALL create or require a second terminal history table.

#### Scenario: Live list excludes killed terminals

- **GIVEN** one terminal instance is running
- **AND** another terminal instance has `processPhase = killed`
- **WHEN** the caller requests the live terminal projection
- **THEN** only the running terminal is returned
- **AND** the killed terminal is absent from the live list

#### Scenario: History index groups live before killed

- **GIVEN** there are live terminal instances
- **AND** there are killed non-archived terminal instances
- **WHEN** the caller requests the terminal index projection
- **THEN** live instances appear before killed instances
- **AND** killed instances are ordered by `lastStoppedAt` descending with `updatedAt` as fallback

#### Scenario: Archive remains explicit

- **GIVEN** a killed terminal instance has been archived
- **WHEN** the caller requests the default history/index projection
- **THEN** the archived terminal is absent
- **AND** it remains available only through the archive projection until delete
