## MODIFIED Requirements

### Requirement: Heartbeat SHALL render one continuous message-parts runtime stream

The `Heartbeat` tab SHALL render one continuous runtime surface backed by durable `message-parts` truth. It SHALL show request-side auxiliary rows, AI-visible request/response rows, and compact boundaries in chronological order without rebuilding the primary story from mixed chat rows, request-aux cards, and model-call cards.

#### Scenario: Heartbeat opens with folded auxiliary facts and durable AI-visible rows

- **WHEN** the operator opens `Heartbeat` for a session that already recorded `systemPrompt`, `tools`, `config`, request rows, response rows, or compact boundaries
- **THEN** the stage renders those rows from the durable Heartbeat `message-parts` stream in chronological order
- **AND** `systemPrompt`, `tools`, `config`, and `compact` rows are visually subordinate and collapsed by default
- **AND** AI-visible request/response rows remain readable as the primary stream content

#### Scenario: Heartbeat updates live without mixed inspection cards

- **WHEN** the runtime records a streamed assistant update or a new Heartbeat request row while the operator is watching the tab
- **THEN** the stage updates the affected durable Heartbeat row in place
- **AND** the operator does not need a separate model-call card to understand the live Heartbeat state
