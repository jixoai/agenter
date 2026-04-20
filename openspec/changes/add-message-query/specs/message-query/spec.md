## ADDED Requirements

### Requirement: Message query SHALL expose one message-specific request contract

The message system SHALL expose one message-specific query contract that accepts `chatId`, `mode`, `query`, and pagination controls for authorized room history lookup. `chatId` MAY be one room id, a list of room ids, or `"*"` for all rooms currently authorized to the caller.

#### Scenario: Query one authorized room

- **WHEN** a caller submits `{"chatId":"0xroom","mode":"match","query":"deploy failed"}`
- **THEN** the message query surface evaluates only room `0xroom`
- **THEN** the response reports `mode`, page metadata, and message hits for that room

#### Scenario: Query all authorized rooms

- **WHEN** a caller submits `{"chatId":"*","mode":"query","query":"from:auth:kzf deploy failed"}`
- **THEN** the message query surface resolves the caller's currently authorized room set before searching
- **THEN** the response only includes results from that authorized room set

### Requirement: Message query SHALL support match query and sql modes

The message query surface SHALL support three modes with stable semantics: `match`, `query`, and `sql`. `match` SHALL provide predictable literal or substring matching, `query` SHALL compile shared search-syntax clauses into message-specific filters and full-text terms, and `sql` SHALL provide advanced read-only analysis against authorized message views.

#### Scenario: Match mode returns predictable literal hits

- **WHEN** a caller runs `mode:"match"` with query text `deploy failed`
- **THEN** the response uses the message system's normalized message text for deterministic substring matching
- **THEN** the result does not depend on fielded parser semantics

#### Scenario: Query mode applies shared field syntax

- **WHEN** a caller runs `mode:"query"` with query text `from:auth:kzf has:attachment before:2026-04-20 "incident report"`
- **THEN** the message query surface applies the shared query parser
- **THEN** the result respects the structured message-specific filters and text search terms together

#### Scenario: Sql mode returns read-only analysis rows

- **WHEN** a caller runs `mode:"sql"` with a valid `SELECT` over authorized message views
- **THEN** the response returns columns and rows instead of ranked message hits
- **THEN** the query still stays limited to the caller's authorized room scope

### Requirement: Message query SHALL enforce authorization before search execution

Message query SHALL treat room capability as the authorization root. A caller SHALL only be able to search rooms for which it currently holds authorized room capability, and `chatId:"*"` SHALL expand only to that caller's current authorized room set.

#### Scenario: Unauthorized room is excluded from explicit scope

- **WHEN** a caller requests `chatId:["0xauthorized","0xforbidden"]`
- **THEN** the query surface rejects or excludes `0xforbidden` according to the room authorization outcome
- **THEN** no hits from `0xforbidden` appear in the final result

#### Scenario: Sql mode cannot bypass room scope

- **WHEN** a caller runs `mode:"sql"` against the message query surface
- **THEN** the SQL executes only against pre-authorized read-only views
- **THEN** the caller cannot widen scope to rooms that were not authorized before the SQL began

### Requirement: Message query SHALL use a rebuildable SQLite index projection

Message query SHALL maintain a SQLite-backed index projection that can be rebuilt from durable room truth. That projection MAY accelerate text retrieval, but it SHALL NOT become the canonical owner of room messages, grants, or room metadata.

#### Scenario: Missing query index rebuilds from room truth

- **WHEN** durable room history exists but the message-query sidecar is missing
- **THEN** the system can rebuild the message query index from durable room truth
- **THEN** searchable room history remains available without a second canonical message store

#### Scenario: Query index failure does not roll back room truth

- **WHEN** a room message write succeeds but message-query index synchronization fails
- **THEN** the durable room write remains committed
- **THEN** the query index is marked for later reconciliation instead of becoming a second source of truth

### Requirement: Sql mode SHALL remain strictly read-only

The `sql` query mode SHALL only accept one read-only statement. The query surface SHALL reject mutating SQL, multi-statement SQL, and commands that alter connection state or attach additional databases.

#### Scenario: Mutating sql is rejected

- **WHEN** a caller submits `mode:"sql"` with `DELETE FROM messages`
- **THEN** the query surface rejects the request
- **THEN** no durable room state or query index state is changed

#### Scenario: Attach pragma and multi-statement sql are rejected

- **WHEN** a caller submits `mode:"sql"` with `ATTACH 'other.db' AS other; SELECT * FROM messages`
- **THEN** the query surface rejects the request before execution
- **THEN** the caller cannot add extra databases or run a second statement inside one request
