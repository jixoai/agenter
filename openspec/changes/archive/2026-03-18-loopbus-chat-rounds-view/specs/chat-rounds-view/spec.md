## ADDED Requirements

### Requirement: Session chat rounds are projected from LoopBus cycles
The system SHALL expose chat history as ordered rounds derived from `session_cycle.collectedInputs`, `session_block.cycleId`, and related model-call facts, instead of requiring the main chat UI to reconstruct rounds from a flat message stream.

#### Scenario: Query completed rounds
- **WHEN** a client queries chat rounds for a session with completed cycles
- **THEN** the response returns rounds ordered from oldest to newest, and each round includes its `cycleId`, `kind`, `status`, collected inputs, assistant outputs, `clientMessageIds`, and `modelCallId`

#### Scenario: Distinguish compact rounds
- **WHEN** a collected user input for a cycle contains `/compact`
- **THEN** the projected round is marked as `compact` instead of `model`

### Requirement: Live rounds remain visible before persistence
The runtime SHALL surface the active round while a cycle is being collected, streamed, or applied, and the client SHALL preserve an optimistic round for a user send until the persisted cycle round supersedes it.

#### Scenario: Show optimistic round immediately
- **WHEN** the user sends chat input and no `session_cycle` row exists yet
- **THEN** the client shows a pending round containing the submitted inputs immediately

#### Scenario: Replace optimistic round with the persisted cycle
- **WHEN** the runtime emits a round update for a persisted cycle carrying the same `clientMessageId`
- **THEN** the client replaces the pending round with the persisted cycle round and keeps the newest streamed assistant output

### Requirement: The main chat surface renders round timeline navigation
The main chat surface SHALL render chat history as round entries with collected inputs and model outputs grouped together, and it SHALL support round-based paging plus direct cycle navigation.

#### Scenario: Render a round as collect plus output
- **WHEN** the main chat surface renders a round containing user inputs, tool activity, and assistant replies
- **THEN** the UI shows those items inside one round entry with distinct collect and output sections

#### Scenario: Page older rounds by cycle cursor
- **WHEN** the client requests more history before a known cycle id
- **THEN** the server returns only rounds older than that cycle, and the UI appends them without duplicating existing rounds
