## ADDED Requirements

### Requirement: App-server SHALL manage auth-service as the canonical child runtime
App-server SHALL manage the auth authority as an auth-service child runtime or external dependency. Profile-service runtime names, package imports, and config keys MAY remain as compatibility aliases only when they resolve to the same auth-service authority.

#### Scenario: App-server starts canonical auth-service child runtime
- **WHEN** app-server boots without an explicit external auth-service endpoint configured
- **THEN** it starts a local auth-service child runtime
- **THEN** the discovered endpoint and descriptor identify the child as auth-service

#### Scenario: Legacy profileService option remains a compatibility alias
- **WHEN** app-server receives a legacy `profileService` configuration field during the compatibility window
- **THEN** it maps that field to the canonical auth-service runtime options
- **THEN** it does not start both profile-service and auth-service runtimes

### Requirement: Auth-service storage defaults SHALL avoid duplicate durable authorities
New auth-service child runtimes SHALL default to an auth-service storage root. If legacy profile-service storage exists and no auth-service storage exists, the resolver MAY use the legacy storage root as an explicit compatibility fallback, but it SHALL NOT create two writable stores for the same authority.

#### Scenario: Fresh runtime uses auth-service storage
- **WHEN** app-server starts a fresh local auth-service child runtime
- **THEN** the default data directory is under an auth-service-named path
- **THEN** the database filename is auth-service-named

#### Scenario: Legacy profile-service storage is reused explicitly
- **WHEN** legacy profile-service storage exists and no auth-service storage has been created
- **THEN** the runtime resolves one writable storage root for the auth authority
- **THEN** it does not create a second independent auth database
