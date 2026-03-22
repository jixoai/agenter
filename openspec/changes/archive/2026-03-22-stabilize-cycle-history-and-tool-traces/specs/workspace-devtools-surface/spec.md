## MODIFIED Requirements

### Requirement: Devtools SHALL preserve persisted cycle history across lifecycle changes
The cycle inspection surface SHALL continue to render persisted cycle history after a session is paused or aborted, unless the session history itself has been removed.

#### Scenario: Paused session still shows cycles
- **WHEN** a session with persisted cycle history is paused
- **THEN** Devtools continues to show the previously loaded cycle timeline and detail
- **THEN** the empty-state message is not shown just because live runtime state was cleared

### Requirement: Cycle technical records SHALL render as merged tool traces
Tool call and tool result records for the same tool invocation SHALL render as one tool trace card in cycle detail.

#### Scenario: Tool call and result are paired
- **WHEN** a cycle contains a tool call followed by its result
- **THEN** cycle detail renders one trace card with call and result sections
- **THEN** the card status reflects `done` or `failed` based on the result
