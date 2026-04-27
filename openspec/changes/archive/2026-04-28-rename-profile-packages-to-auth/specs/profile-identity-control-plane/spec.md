## ADDED Requirements

### Requirement: Identity control plane SHALL use auth-service as the canonical authority name
The identity control plane SHALL name the auth authority as auth-service in package imports, child-runtime descriptors, and durable platform documentation. `profile-service` SHALL remain only as a compatibility alias; profile projections and profile media owners remain domain objects served by that authority.

#### Scenario: App-server delegates identity creation to auth-service
- **WHEN** app-server exposes convenience mutations or queries for global avatar creation, managed principal listing, or profile projection reads
- **THEN** it delegates identity creation and lookup to auth-service
- **THEN** any profile-service bridge or package path is only a compatibility alias to the same authority

#### Scenario: Profile owner semantics remain intact
- **WHEN** a caller resolves public profile projection or profile icon media
- **THEN** the object remains a profile projection or profile media owner
- **THEN** the service package and runtime identity remain auth-service
