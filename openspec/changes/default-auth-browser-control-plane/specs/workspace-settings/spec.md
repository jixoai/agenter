# workspace-settings Specification

## ADDED Requirements

### Requirement: Browser-facing workspace settings SHALL require authenticated superadmin authority
Workspace settings SHALL remain readable without an active runtime session for the target workspace, but browser-facing settings inspection and mutation SHALL require an authenticated superadmin browser session.

#### Scenario: Anonymous browser cannot inspect workspace settings
- **WHEN** a browser caller requests workspace settings graph or layer content without a valid superadmin browser auth session
- **THEN** the daemon rejects the request with an authorization failure
- **THEN** sessionless settings inspection does not imply anonymous browser access

#### Scenario: Superadmin can inspect and edit workspace settings without a runtime session
- **WHEN** a superadmin browser caller requests workspace settings for a workspace path that has no active runtime session
- **THEN** the daemon returns the normal workspace-settings contract shape for that workspace
- **THEN** the operator can continue using the same sessionless settings workflow after authentication
