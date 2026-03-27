## ADDED Requirements

### Requirement: Tool invocation payloads SHALL reuse structured YAML preview controls
Tool invocation call/result payload sections MUST use the shared structured preview component so payload mode switching stays consistent with the rest of Devtools.

#### Scenario: Invocation payload defaults to YAML preview
- **WHEN** a tool invocation card renders structured call or result payloads
- **THEN** payloads default to highlighted YAML mode
- **THEN** local/global preview mode controls remain available through the shared menu contract
