## MODIFIED Requirements

### Requirement: Session chat cycles are projected from LoopBus cycles

The system SHALL expose chat history as ordered cycles derived from `session_cycle` facts, and all public chat projection APIs SHALL use `cycle` terminology instead of `round`. The WebUI MAY project those cycles into a conversation-first stream, but cycle identity SHALL remain stable so Chat and Devtools can both navigate by cycle. Manual compact requests SHALL remain projected as `kind: "compact"` cycles with their trigger preserved.

#### Scenario: Query completed cycles

- **WHEN** a client queries chat cycles for a session with completed LoopBus cycles
- **THEN** the response returns cycles ordered from oldest to newest, and each cycle includes its `cycleId`, `kind`, `status`, collected inputs, assistant outputs, `clientMessageIds`, and `modelCallId`

#### Scenario: UI can navigate conversation by cycle identity

- **WHEN** the WebUI renders a conversation-first view and a cycle-oriented Devtools timeline for the same session
- **THEN** both surfaces can reference the same stable cycle identifiers
- **THEN** chat-side cycle navigation can jump to the corresponding cycle-backed content

#### Scenario: Manual compact cycle remains distinguishable

- **GIVEN** a session includes a normal model cycle followed by a manual `/compact` cycle
- **WHEN** a client queries chat cycles
- **THEN** the compact cycle appears in chronological order with the surrounding model cycles
- **AND** the compact cycle has `kind` equal to `compact`
- **AND** the compact cycle has `compactTrigger` equal to `manual`
