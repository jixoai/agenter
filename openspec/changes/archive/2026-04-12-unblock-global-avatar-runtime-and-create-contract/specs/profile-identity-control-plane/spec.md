## MODIFIED Requirements

### Requirement: Auth system SHALL mint managed principals for avatar entities

The auth identity control plane SHALL treat Avatar as a managed-principal kind. Public avatar metadata SHALL live on the avatar principal record instead of being invented as a second app-server-only identity row.

#### Scenario: Avatar principal is created with public metadata

- **WHEN** a caller creates a managed principal with `kind: "avatar"` and metadata including `nickname` plus optional `displayName` or nullable `classify`
- **THEN** the service returns a stable avatar principal identity and persists that metadata on the principal
- **AND** later reads resolve the same avatar identity without requiring a second avatar registry

#### Scenario: App-server bridge does not become a second identity authority

- **WHEN** app-server exposes convenience mutations or queries for global avatar creation and listing
- **THEN** it delegates identity creation and lookup to AuthSystem/profile-service
- **AND** it does not persist a competing avatar identity truth outside the managed principal control plane
