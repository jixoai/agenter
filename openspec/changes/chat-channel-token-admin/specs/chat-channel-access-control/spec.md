## ADDED Requirements

### Requirement: Trusted bootstrap SHALL return channel access projections
The trusted chat bootstrap APIs SHALL return a channel access projection that includes the caller's role, an opaque channel token, and a tokenized transport endpoint for that specific channel.

#### Scenario: Creating a channel returns bootstrap admin access
- **WHEN** a trusted runtime caller creates a new chat channel
- **THEN** the response includes an `admin` access projection for that channel
- **THEN** the projection includes an opaque token and a transport endpoint that is ready for websocket use

#### Scenario: Listing channels returns reusable access for existing channels
- **WHEN** a trusted runtime caller lists chat channels for the current session context
- **THEN** each returned channel entry includes the caller's access role for that channel
- **THEN** the entry includes the tokenized transport endpoint needed by chat clients

### Requirement: Chat channel tokens SHALL gate channel-scoped operations
The chat control plane SHALL require a valid channel token for channel-scoped reads, writes, and focus operations, and SHALL enforce role-specific permissions for `readonly`, `member`, and `admin` callers.

#### Scenario: Readonly access can observe but not send
- **WHEN** a caller uses a valid `readonly` token
- **THEN** the caller can fetch snapshots, page history, and subscribe to transport updates for that channel
- **THEN** attempts to send or reply are rejected

#### Scenario: Member access can send but not administer
- **WHEN** a caller uses a valid `member` token
- **THEN** the caller can send or reply within that channel
- **THEN** attempts to update channel metadata or issue tokens are rejected

#### Scenario: Revoked or missing token is rejected
- **WHEN** a caller invokes a channel-scoped API without a valid current token
- **THEN** the control plane rejects the request
- **THEN** the response does not leak channel contents

### Requirement: Chat transport SHALL validate tokens before hydration
The websocket transport SHALL validate the channel token before sending a snapshot or accepting interactive messages.

#### Scenario: Transport rejects missing token
- **WHEN** a websocket client connects to `/chat/$CHAT_ID` without a valid token
- **THEN** the server closes the connection without sending the channel snapshot
- **THEN** the client receives an authorization failure instead of channel data

#### Scenario: Transport hydrates an authorized client
- **WHEN** a websocket client connects with a valid channel token
- **THEN** the server sends the channel snapshot first
- **THEN** later incremental events remain limited to that authorized channel
