## MODIFIED Requirements

### Requirement: Client runtime store SHALL expose typed workspace CLI catalog queries

The client runtime store SHALL expose typed methods for the workspace CLI catalog instead of requiring the Workspace route to call raw transport clients directly.

The client runtime store SHALL also expose typed workspace exec input that can choose the execution surface explicitly.

#### Scenario: Workspace route executes one command through typed runtime store input

- **WHEN** the Workspace shell dialog runs a command
- **THEN** it can call one typed runtime-store workspace exec method with `surface`
- **AND** the route does not instantiate its own ad hoc transport layer
