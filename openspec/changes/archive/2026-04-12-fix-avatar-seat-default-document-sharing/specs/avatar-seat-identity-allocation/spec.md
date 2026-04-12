## ADDED Requirements

### Requirement: Avatar seat initialization SHALL allocate isolated principals
When seat documents are missing or invalid, each seat path SHALL start from a fresh default document so private-key and principal allocation remains isolated per seat file.

#### Scenario: Two new seat files in one workspace receive distinct principals
- **GIVEN** two distinct seat paths with no existing seat files in the same workspace
- **WHEN** the backend allocates seat principals for both seat paths
- **THEN** the two principal ids are different
- **AND** each seat document persists its own principal instead of inheriting the other's in-memory state
