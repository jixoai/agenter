## ADDED Requirements

### Requirement: Client runtime store SHALL keep bounded windows for long-list resources
The client runtime store SHALL maintain bounded in-memory windows for long-history resources and SHALL keep pagination state separate from the visible list projection.

#### Scenario: Recent windows stay hydrated without loading full history
- **WHEN** a route hydrates a long-history resource for the active session
- **THEN** the store keeps only the configured recent window in memory by default
- **THEN** older history remains available through explicit pagination state instead of implicit eager hydration

#### Scenario: Loading older pages does not duplicate or unbound the resource window
- **WHEN** the store prepends older pages for a long-history resource
- **THEN** existing rows are not duplicated
- **THEN** the resource window remains bounded according to the shared controller policy
