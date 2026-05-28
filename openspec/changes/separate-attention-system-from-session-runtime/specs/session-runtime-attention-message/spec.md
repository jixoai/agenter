## MODIFIED Requirements

### Requirement: Message follow-up compatibility SHALL remain a watch alias
If `followUpAfterMs` remains supported on `message send`, it SHALL stay a compatibility alias for the generic one-shot watch primitive. It creates later re-decision attention only, and SHALL NOT auto-send another room-visible message. The reminder attention MUST be durably committed through the independent attention control plane even when the owner runtime is offline.

#### Scenario: Follow-up compatibility creates private reminder only
- **WHEN** `message send` is called with `followUpAfterMs`
- **THEN** the runtime binds a one-shot reminder to the sent durable `messageId`
- **AND** that reminder remains sender-private runtime scheduling state rather than shared room truth

#### Scenario: Follow-up compatibility uses a generic watch predicate
- **WHEN** `message send` receives `followUpAfterMs`
- **THEN** runtime creates a generic one-shot watch owned by the explicit message action
- **AND** the watch predicate references objective room state such as whether the sent message remains the latest visible fact

#### Scenario: Reminder expiry does not auto-send a room message
- **WHEN** the compatible follow-up reminder expires while its predicate still holds
- **THEN** the runtime creates only attention/watch reminder truth for re-decision
- **AND** any later room-visible reply still requires an explicit `message send`, `message edit`, or `message recall`

#### Scenario: Reminder expiry persists attention before runtime restart
- **WHEN** a follow-up reminder expires while the owner runtime is stopped
- **THEN** message-system writes the reminder attention durably through the independent attention control plane
- **AND** the later runtime restart recovers that reminder from attention truth instead of needing timer replay
