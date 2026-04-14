## MODIFIED Requirements

### Requirement: Heartbeat SHALL render one continuous message-parts runtime stream

The `Heartbeat` tab SHALL render one continuous runtime surface backed by durable `message-parts` truth. It SHALL show request-side auxiliary rows, AI-visible request/response rows, and compact boundaries in chronological order without rebuilding the primary story from mixed chat rows, request-aux cards, and model-call cards. Default Heartbeat row presentation SHALL use inspection-first surfaces, high-signal metadata, single-layer payload chrome, collapsed tool previews, and the active AvatarSession icon instead of generic chat bubble styling.

#### Scenario: Heartbeat opens with folded auxiliary facts and durable AI-visible rows

- **WHEN** the operator opens `Heartbeat` for a session that already recorded `systemPrompt`, `tools`, `config`, request rows, response rows, or compact boundaries
- **THEN** the stage renders those rows from the durable Heartbeat `message-parts` stream in chronological order
- **AND** `systemPrompt`, `tools`, `config`, and `compact` rows are visually subordinate and collapsed by default
- **AND** AI-visible request/response rows remain readable as the primary stream content

#### Scenario: Heartbeat updates live without mixed inspection cards

- **WHEN** the runtime records a streamed assistant update or a new Heartbeat request row while the operator is watching the tab
- **THEN** the stage updates the affected durable Heartbeat row in place
- **AND** the operator does not need a separate model-call card to understand the live Heartbeat state

#### Scenario: Default Heartbeat rows avoid redundant role and round noise

- **WHEN** a normal Heartbeat row renders a durable `message-parts` entry
- **THEN** the default row chrome does not repeat low-signal chips such as duplicated `user` labels, `round 0`, or `Text`
- **AND** the header preserves only the high-value metadata needed for rapid operator scanning

#### Scenario: Plain text payloads do not render nested card chrome

- **WHEN** a Heartbeat row renders a normal text or thinking payload
- **THEN** the operator sees one primary payload surface instead of two stacked bordered cards for the same fact

#### Scenario: Collapsed tool rows expose a high-signal preview

- **WHEN** a Heartbeat row contains a tool block with shell-style input such as `command` or `cmd`
- **THEN** the collapsed tool header shows a concise preview derived from that input
- **AND** the preview favors the leading command intent, such as `attention commit`, before long serialized arguments
