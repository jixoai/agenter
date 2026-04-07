## MODIFIED Requirements

### Requirement: App-server SHALL compose session-facing room views from room truth and session facts

App-server SHALL rebuild session-facing room histories by joining session facts with global room truth instead of replaying room history out of `session.db` alone.

#### Scenario: Session primary room id is persisted instead of derived from session id
- **WHEN** app-server creates or reuses a session
- **THEN** it persists a managed principal-backed `primaryRoomId` in session durability
- **AND** later runtime starts and stopped-session read paths reuse that stored room id instead of deriving `room-main-${sessionId}`

#### Scenario: Runtime-created rooms use managed room principal allocation
- **WHEN** a running session creates an additional room through runtime tooling
- **THEN** app-server allocates a managed room principal for that room id
- **AND** session runtime does not synthesize durable `room-*` ids locally
