## MODIFIED Requirements

### Requirement: Runtime inspection SHALL expose canonical provider metadata
The runtime SHALL expose canonical provider metadata and capabilities in draft resolution and model-call records so that operator tooling can inspect the actual transport contract in use.

#### Scenario: Inspecting draft provider metadata
- **WHEN** a draft session is resolved for a workspace
- **THEN** the returned provider metadata includes `apiStandard`, `vendor`, `model`, and `baseUrl` when available

#### Scenario: Inspecting transport records
- **WHEN** operator tooling inspects published model-call records for a session
- **THEN** those records include canonical provider metadata and computed capabilities for the active provider
- **THEN** tooling does not depend on a standalone model-debug endpoint to inspect the transport contract
