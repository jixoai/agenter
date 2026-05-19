## RENAMED Requirements

### Requirement: Requester writes SHALL create approval requests
FROM: Requester writes SHALL create approval requests
TO: Guard writes SHALL create approval requests

## MODIFIED Requirements

### Requirement: Terminal resources SHALL enforce actor-scoped grants

The terminal collaboration control plane SHALL enforce grants bound to auth actors or session actors with roles `admin`, `writer`, `guard`, and `readonly`. Focus state SHALL also remain actor-scoped and SHALL be mutated only through that actor's terminal authority or a valid superadmin recovery path. A valid global superadmin claim MAY administer any terminal regardless of local grants.

#### Scenario: Readonly actor can observe but not write
- **WHEN** an auth actor or session actor holds a `readonly` grant for a terminal
- **THEN** that actor can subscribe to terminal output, snapshots, and status
- **THEN** attempts to send terminal input are rejected

#### Scenario: Guard actor can request but not directly write
- **WHEN** an auth actor or session actor holds a `guard` grant for a terminal
- **THEN** that actor can subscribe to terminal output, snapshots, and status
- **THEN** attempts to send terminal input without an active write lease are rejected before reaching the PTY
- **THEN** automation writes may create approval requests through the terminal approval path

#### Scenario: Superadmin can recover terminal administration
- **WHEN** a valid global superadmin claim is presented for a terminal whose local admin grants are missing or misconfigured
- **THEN** the control plane allows that caller to inspect and repair terminal grants
- **THEN** terminal recovery does not require an existing terminal-local admin grant

#### Scenario: Focus mutation uses actor-scoped authority
- **WHEN** an actor focuses or unfocuses a terminal
- **THEN** the control plane validates that mutation against that actor's grant or superadmin recovery authority
- **THEN** the resulting focus state is stored only for that actor seat

#### Scenario: One actor cannot clear another actor's focus without admin authority
- **WHEN** a non-admin actor attempts to clear another actor seat's focus state
- **THEN** the control plane rejects that mutation
- **THEN** the other actor's focus truth remains unchanged

#### Scenario: Selected seat token survives superadmin operator context
- **WHEN** a superadmin operator uses a seat token to focus, read, or write a terminal on behalf of that seat
- **THEN** terminal-system validates the action against that seat token
- **THEN** the recorded actor and focus truth belong to the selected seat instead of the superadmin operator

### Requirement: Admin-group promotion SHALL preserve the actor's base write semantics

Promotion into the current-admin slot SHALL preserve the candidate's base write semantics. A candidate that is `readonly` outside the admin slot SHALL remain read-only after promotion, while a candidate that is `guard` outside the admin slot SHALL gain effective direct write ability once promoted and SHALL NOT need to self-approve its own writes.

#### Scenario: Readonly candidate becomes a readonly admin
- **WHEN** a candidate with readonly write semantics is promoted into the current-admin slot
- **THEN** that actor becomes the current admin for grant and approval routing
- **THEN** its own PTY write semantics remain readonly unless separately elevated

#### Scenario: Guard candidate becomes directly writable after promotion
- **WHEN** a candidate with guard-style write semantics is promoted into the current-admin slot
- **THEN** that actor becomes the current admin for grant and approval routing
- **THEN** its own writes no longer require a self-issued approval round-trip

### Requirement: Guard writes SHALL create approval requests

Actors with the `guard` role SHALL NOT write directly to the PTY without an active write lease. Instead, each blocked automation write attempt that requests approval creation SHALL create an approval request with an explicit, configurable expiry whose default is `90s`, and SHALL remain rejected until approved.

#### Scenario: Guard submit creates approval request
- **WHEN** a guard actor attempts to submit terminal input without a valid write lease
- **THEN** the control plane rejects the write before it reaches the PTY
- **THEN** it creates an approval request targeted at the current terminal admin

#### Scenario: Expired approval request does not unlock writes
- **WHEN** an approval request reaches its expiry without an approval decision
- **THEN** the request is no longer actionable for write unlocking
- **THEN** later writes still require a new approval request or an existing valid lease

#### Scenario: Offline admin timeout falls back to deny
- **WHEN** an approval request is waiting while no current terminal admin is online to process it
- **THEN** the request remains pending only until the configured expiry window
- **THEN** if no admin comes online and decides before expiry, the request times out and is denied by default

#### Scenario: Repeated equivalent guard request is coalesced
- **WHEN** a guard actor repeats the same terminal write or input request for the same live terminal instance while an equivalent approval request is still pending
- **THEN** the control plane reuses or refreshes the existing pending approval request
- **THEN** it does not create unbounded duplicate prompts for the same actor, terminal instance, input mode, and requested input
- **THEN** a materially different requested input can create a separate approval request

#### Scenario: Denied approval request does not unlock writes
- **WHEN** an admin denies a guard approval request
- **THEN** the denied request is no longer actionable for write unlocking
- **THEN** no terminal input from that request reaches the PTY
- **THEN** later writes still require a new approval request or an existing valid lease

### Requirement: Approved requests SHALL mint timeboxed write leases

When an admin approves a guard write flow, the control plane SHALL mint a timeboxed write lease with an explicit expiry, and every terminal input path, including transport input and raw writes, SHALL enforce that lease before reaching the PTY.

#### Scenario: Approved lease unlocks raw and mixed terminal input
- **WHEN** an admin approves a guard write request for a `30m`, `2h`, or `24h` duration
- **THEN** the control plane grants a write lease valid until the computed expiry
- **THEN** both raw terminal writes and mixed terminal input are accepted until that lease expires

#### Scenario: Expired lease blocks further writes
- **WHEN** a previously approved write lease has passed its expiry time
- **THEN** subsequent terminal writes are rejected again
- **THEN** the actor must obtain a fresh approval or a stronger grant before writing
