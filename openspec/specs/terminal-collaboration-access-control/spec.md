# terminal-collaboration-access-control Specification

## Purpose
Define actor-scoped grants, admin-group failover, approval routing, and write leases for the global terminal control plane.

## Requirements
### Requirement: Terminal resources SHALL enforce actor-scoped grants
The terminal collaboration control plane SHALL enforce grants bound to auth actors or session actors with roles `admin`, `writer`, `requester`, and `readonly`. Focus state SHALL also remain actor-scoped and SHALL be mutated only through that actor's terminal authority or a valid superadmin recovery path. A valid global superadmin claim MAY administer any terminal regardless of local grants.

#### Scenario: Readonly actor can observe but not write
- **WHEN** an auth actor or session actor holds a `readonly` grant for a terminal
- **THEN** that actor can subscribe to terminal output, snapshots, and status
- **THEN** attempts to send terminal input are rejected

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

### Requirement: Terminal administration SHALL elect one current admin from an ordered admin group
Each terminal SHALL expose one current local admin at a time, while an ordered admin-group candidate list MAY be configured behind it. When the current admin goes offline, the next eligible candidate in order SHALL be promoted, and any still-pending approval work SHALL be reassigned to the newly promoted admin. If a higher-priority eligible candidate later comes online, it SHALL immediately preempt and become the current admin.

#### Scenario: Offline admin hands off to the next candidate
- **WHEN** the current terminal admin goes offline and a lower-ranked eligible candidate is available
- **THEN** the control plane promotes the next eligible candidate to current admin
- **THEN** unresolved approval requests are reassigned to that promoted admin

#### Scenario: Higher-priority candidate preempts when it returns
- **WHEN** a higher-priority eligible candidate in the admin group comes online while a lower-priority admin is currently active
- **THEN** the higher-priority candidate immediately becomes the current admin
- **THEN** unresolved approval requests are re-forwarded to the newly promoted admin

### Requirement: Admin-group promotion SHALL preserve the actor's base write semantics
Promotion into the current-admin slot SHALL preserve the candidate's base write semantics. A candidate that is `readonly` outside the admin slot SHALL remain read-only after promotion, while a candidate that is `requester` outside the admin slot SHALL gain effective direct write ability once promoted and SHALL NOT need to self-approve its own writes.

#### Scenario: Readonly candidate becomes a readonly admin
- **WHEN** a candidate with readonly write semantics is promoted into the current-admin slot
- **THEN** that actor becomes the current admin for grant and approval routing
- **THEN** its own PTY write semantics remain readonly unless separately elevated

#### Scenario: Requester candidate becomes directly writable after promotion
- **WHEN** a candidate with requester-style write semantics is promoted into the current-admin slot
- **THEN** that actor becomes the current admin for grant and approval routing
- **THEN** its own writes no longer require a self-issued approval round-trip

### Requirement: Requester writes SHALL create approval requests
Actors with the `requester` role SHALL NOT write directly to the PTY. Instead, each blocked write attempt SHALL create an approval request with an explicit, configurable expiry whose default is `90s`, and SHALL remain rejected until approved.

#### Scenario: Requester submit creates approval request
- **WHEN** a requester attempts to submit terminal input without a valid write lease
- **THEN** the control plane rejects the write
- **THEN** it creates an approval request targeted at the current terminal admin

#### Scenario: Expired approval request does not unlock writes
- **WHEN** an approval request reaches its expiry without an approval decision
- **THEN** the request is no longer actionable for write unlocking
- **THEN** later writes still require a new approval request or an existing valid lease

#### Scenario: Offline admin timeout falls back to deny
- **WHEN** an approval request is waiting while no current terminal admin is online to process it
- **THEN** the request remains pending only until the configured expiry window
- **THEN** if no admin comes online and decides before expiry, the request times out and is denied by default

### Requirement: Approved requests SHALL mint timeboxed write leases
When an admin approves a requester write flow, the control plane SHALL mint a timeboxed write lease with an explicit expiry, and every terminal input path, including transport input and raw writes, SHALL enforce that lease before reaching the PTY.

#### Scenario: Approved lease unlocks raw and submitted writes
- **WHEN** an admin approves a requester's write request for a `30m`, `2h`, or `24h` duration
- **THEN** the control plane grants a write lease valid until the computed expiry
- **THEN** both submitted input and raw terminal writes are accepted until that lease expires

#### Scenario: Expired lease blocks further writes
- **WHEN** a previously approved write lease has passed its expiry time
- **THEN** subsequent terminal writes are rejected again
- **THEN** the actor must obtain a fresh approval or a stronger grant before writing

### Requirement: Browser auth SHALL gate global terminal control-plane routes before terminal grants apply
Browser-facing global terminal routes SHALL require an authenticated browser auth session before they evaluate terminal grants, seat tokens, approval requests, or superadmin recovery authority.

#### Scenario: Terminal seat token alone cannot bypass browser auth
- **WHEN** a browser caller invokes a global terminal route with a valid seat token or terminal grant but without a valid browser bearer token
- **THEN** the daemon rejects the request with `UNAUTHORIZED`
- **THEN** terminal-scoped credentials do not reopen anonymous browser access to the control plane

#### Scenario: Authenticated browser caller still uses terminal-scoped authority
- **WHEN** a browser caller invokes a global terminal route with a valid browser bearer token
- **THEN** the daemon continues evaluating terminal grants, seat tokens, approval requests, or superadmin recovery authority for that terminal
- **THEN** browser auth identifies the operator while terminal authority remains resource-scoped
