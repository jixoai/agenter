# chat-channel-access-control Specification

## Purpose
Define actor-scoped room credentials, room-local admin failover, and transport authorization for the global message control plane.
## Requirements
### Requirement: Trusted bootstrap SHALL return channel access projections
Trusted bootstrap and superadmin room APIs SHALL return a room access projection that includes the caller's room role, an opaque room-scoped credential, and a transport endpoint for that specific global room.

#### Scenario: Creating a room returns bootstrap admin access
- **WHEN** a trusted auth actor or session-bootstrap path creates a new room
- **THEN** the response includes an `admin` access projection for that room
- **THEN** the projection includes the room credential and a ready-to-use transport endpoint

#### Scenario: Listing rooms returns reusable access for an attached actor
- **WHEN** an auth actor or session actor lists rooms available to it
- **THEN** each room entry includes that actor's current effective role
- **THEN** the entry includes the credential or transport information needed to open the room

#### Scenario: Different sessions receive different room credentials even if names match
- **WHEN** two different session actors with the same visible avatar name attach to the same room
- **THEN** the control plane issues distinct room credentials for those two session actors
- **THEN** the room keeps them as separate seats instead of merging them by display name

### Requirement: Chat channel tokens SHALL gate channel-scoped operations
The room control plane SHALL require a valid current room credential for room-scoped reads, writes, and focus operations, and SHALL enforce role-specific permissions for `readonly`, `member`, and `admin` callers. A valid global superadmin claim MAY recover or administer a room without holding a room-local admin grant.

#### Scenario: Readonly access can observe but not send
- **WHEN** a caller uses a valid `readonly` room grant
- **THEN** the caller can fetch snapshots, page history, and subscribe to transport updates for that room
- **THEN** attempts to send or administer the room are rejected

#### Scenario: Member access can send but not administer
- **WHEN** a caller uses a valid `member` room grant
- **THEN** the caller can send or reply within that room
- **THEN** attempts to update room metadata or issue grants are rejected

#### Scenario: Superadmin can recover a room without a local admin grant
- **WHEN** a caller presents a valid global superadmin claim for a room that has lost all visible admins
- **THEN** the control plane allows that caller to inspect and repair room grants
- **THEN** the recovery path does not require a preexisting room-local admin credential

#### Scenario: Invalid room credential returns an explicit invalid state
- **WHEN** a caller presents a room credential that is expired, revoked, or malformed
- **THEN** the control plane rejects the room-scoped operation
- **THEN** the failure reports a stable `credential-invalid` style reason instead of silently treating the caller as a successful room member

### Requirement: Room-local admin authority SHALL resolve through one current admin plus an ordered candidate group
Each room SHALL expose one current room-local admin at a time, while an ordered admin-group candidate list MAY be configured behind it. In the first slice, the still-pending room admin work that follows this routing model SHALL be limited to core chat-governance actions: room grant issuance or revocation, participant actor binding edits, and room metadata updates. When the current admin goes offline or otherwise becomes unavailable, the next eligible candidate in order SHALL be promoted, and any still-pending room admin work SHALL be reassigned to the newly promoted admin. If a higher-priority eligible candidate later comes online, it SHALL immediately preempt and become the current admin.

#### Scenario: Offline current admin promotes the next candidate
- **WHEN** the current room-local admin becomes unavailable while the room still has eligible admin-group candidates
- **THEN** the next candidate in priority order becomes the current admin
- **THEN** pending room admin work is reassigned to that promoted admin

#### Scenario: Higher-priority candidate preempts when coming online
- **WHEN** a higher-priority eligible admin-group candidate becomes available after a lower-priority candidate has already been promoted
- **THEN** the higher-priority candidate immediately becomes the current admin
- **THEN** pending room admin work is reassigned again to the newly promoted admin

### Requirement: Chat transport SHALL validate tokens before hydration
The room websocket transport SHALL validate the presented room credential or equivalent authorization before sending a snapshot or accepting interactive messages.

#### Scenario: Transport rejects missing or invalid credential
- **WHEN** a websocket client connects to a room transport endpoint without a valid current credential
- **THEN** the server closes the connection without sending the room snapshot
- **THEN** the client receives an authorization failure instead of room data

#### Scenario: Transport hydrates an authorized actor
- **WHEN** a websocket client connects with a valid room credential
- **THEN** the server sends the room snapshot first
- **THEN** later incremental events remain limited to that authorized room

### Requirement: Browser auth SHALL gate global room control-plane routes before room credentials apply
Browser-facing global room routes SHALL require an authenticated browser auth session before they evaluate room-local access tokens, room grants, or superadmin recovery authority.

#### Scenario: Room credential alone cannot bypass browser auth
- **WHEN** a browser caller invokes a global room route with a valid room access token but without a valid browser bearer token
- **THEN** the daemon rejects the request with `UNAUTHORIZED`
- **THEN** room-scoped credentials do not reopen anonymous browser access to the control plane

#### Scenario: Authenticated browser caller still needs room-scoped authority
- **WHEN** a browser caller invokes a global room route with a valid browser bearer token
- **THEN** the daemon continues evaluating the room access token, grant, or superadmin recovery path for that specific room
- **THEN** browser auth identifies the operator while room authority remains resource-scoped
