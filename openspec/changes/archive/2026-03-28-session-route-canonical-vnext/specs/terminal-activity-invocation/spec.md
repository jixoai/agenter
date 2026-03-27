## MODIFIED Requirements

### Requirement: Terminal activity tool rows SHALL render via unified invocation surface
Terminal activity MUST map tool-call/tool-result records to the shared invocation card contract.

#### Scenario: Legacy YAML tool-call records map to ToolInvocationCard
- **WHEN** activity row contains legacy `yaml+tool_call` or `yaml+tool_result` payload
- **THEN** row is rendered as a `ToolInvocationCard`
- **AND** tool metadata (name/status/result) is preserved

#### Scenario: Empty call payload is omitted
- **WHEN** tool call payload is empty string
- **THEN** invocation call section is hidden
- **AND** UI does not render `""`
