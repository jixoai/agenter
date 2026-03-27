## MODIFIED Requirements

### Requirement: Cycle technical records SHALL render as merged tool traces
Tool lifecycle records SHALL be represented by one structured invocation message (`channel: tool`) instead of paired `tool_call` and `tool_result` markdown records.

#### Scenario: Structured invocation drives cycle detail
- **WHEN** a cycle contains tool lifecycle output
- **THEN** cycle detail renders invocation cards from structured invocation metadata
- **THEN** the UI does not need markdown fence pairing or timestamp heuristics to merge call/result
