## ADDED Requirements

### Requirement: Auth service SHALL be the canonical package identity
The auth authority implementation SHALL be published and consumed through canonical `@agenter/auth-service` and `@agenter/auth-cli` package identities. Legacy `@agenter/profile-service` and `@agenter/profile-cli` packages SHALL remain only as compatibility aliases and SHALL NOT own independent service logic or durable state.

#### Scenario: New product code imports auth-service
- **WHEN** app-server or another first-party package consumes auth identity, managed principal, auth challenge, or typed icon authority APIs
- **THEN** it imports the canonical `@agenter/auth-service` package
- **THEN** no new first-party product import targets `@agenter/profile-service`

#### Scenario: Legacy profile package delegates to auth-service
- **WHEN** a compatibility caller imports `@agenter/profile-service`
- **THEN** the package re-exports the canonical auth-service API
- **THEN** it does not instantiate a second auth authority or maintain duplicate durable state

### Requirement: Auth CLI SHALL be canonical while profile CLI remains an alias
The operator command for the auth authority SHALL expose `auth-cli` as the canonical binary. `profile-cli` MAY remain available as a compatibility alias, but it SHALL delegate to the same command implementation and preserve observable behavior except for canonical help text and naming.

#### Scenario: Operator uses canonical auth-cli
- **WHEN** an operator runs `auth-cli doctor --endpoint <url>`
- **THEN** the command checks the auth-service endpoint
- **THEN** help and status output identify the service as auth-service

#### Scenario: Legacy profile-cli still works
- **WHEN** an operator runs `profile-cli doctor --endpoint <url>`
- **THEN** the command delegates to the same auth CLI implementation
- **THEN** no separate profile CLI state or endpoint client is created

### Requirement: Profile vocabulary SHALL remain only for profile domain objects
The system SHALL keep `profile` vocabulary where it names a user/profile projection, profile media owner, or profile metadata object. The system SHALL NOT use `profile-service` as the canonical name for the auth authority package, child runtime, default storage root, or operator service identity.

#### Scenario: Profile icon route remains semantically distinct
- **WHEN** a caller reads or writes a profile icon
- **THEN** the media owner remains a profile owner
- **THEN** the backend authority that serves it is identified as auth-service rather than profile-service

#### Scenario: Auth service naming does not erase profile projections
- **WHEN** a caller lists or reads profile projections through the auth authority
- **THEN** the returned object vocabulary may still identify profile projections
- **THEN** service descriptors and package names still use canonical auth-service identity
