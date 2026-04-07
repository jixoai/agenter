## MODIFIED Requirements

### Requirement: Runtime shell routes land on a canonical runtime tab
The workspace runtime shell SHALL expose a canonical runtime destination for each avatar session and SHALL route runtime entry URLs to that tab without requiring feature-level navigation glue.

#### Scenario: Runtime rail links land on attention by default
- **WHEN** the operator opens a session from the runtime rail or a direct runtime entry URL without a tab segment
- **THEN** the browser lands on `/avatars/runtime/{sessionId}/attention`
- **AND** the runtime shell renders without an intermediate error page
