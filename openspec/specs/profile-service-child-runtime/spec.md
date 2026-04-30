# profile-service-child-runtime Specification

## Purpose
Define how `app-server` consumes the compatibility-named `profile-service` as the auth authority child runtime or external dependency without becoming a second canonical owner of auth or icon state.

## Requirements
### Requirement: App-server SHALL manage profile-service as a child runtime or external dependency
App-server SHALL manage the auth service as a child runtime or an external dependency, and it SHALL bootstrap or discover the root auth identity needed to administer global resources without becoming a second source of truth for auth state.

#### Scenario: App-server starts the child auth service
- **WHEN** app-server boots without an explicit external auth-service endpoint configured
- **THEN** it starts a local auth-service child runtime and loads or creates the configured root auth key material
- **THEN** app-server can discover the child endpoint and root-auth descriptor needed for later admin flows

#### Scenario: App-server uses an external auth service
- **WHEN** app-server is configured with an external auth-service endpoint
- **THEN** it does not spawn a second local auth-service instance
- **THEN** it delegates auth and auth projection calls to the configured endpoint instead

### Requirement: Compatibility adapters SHALL preserve semantic owner URLs while delegating authority
App-server and client-facing adapters SHALL preserve semantic URL spaces for session icons, auth identity descriptors, and later media reads while delegating durable authority to the auth service. App-server SHALL NOT reintroduce a second local auth state authority.

#### Scenario: Client receives the discovered auth-service endpoint and descriptor
- **WHEN** a client connects to app-server
- **THEN** it can query the discovered auth-service endpoint and its auth descriptor
- **THEN** later auth flows resolve against that independent authority instead of the app-server port

#### Scenario: Session icon ownership remains externalized
- **WHEN** app-server creates or resumes a session while the auth service remains authoritative for identity descriptors
- **THEN** app-server synchronizes only the required session seed facts into that authority
- **THEN** later clients do not rely on app-server-local auth storage as a second source of truth

### Requirement: App-server SHALL manage auth-service as the canonical child runtime
App-server SHALL manage the auth authority as an auth-service child runtime or external dependency. Profile-service runtime names, package imports, and config keys MAY remain as compatibility aliases only when they resolve to the same auth-service authority. When the target local authority root already exposes a healthy auth-service runtime descriptor, app-server SHALL reuse that local authority instead of starting a second runtime.

#### Scenario: App-server starts canonical auth-service child runtime
- **WHEN** app-server boots without an explicit external auth-service endpoint configured
- **THEN** it starts a local auth-service child runtime
- **THEN** the discovered endpoint and descriptor identify the child as auth-service

#### Scenario: App-server reuses a healthy local auth-service authority
- **WHEN** app-server boots without an explicit external auth-service endpoint
- **AND** the target local auth-service authority root already exposes a healthy runtime descriptor
- **THEN** app-server reuses that discovered local endpoint instead of starting a second child runtime
- **AND** descriptor/reveal behavior is projected as external-like because app-server does not own that runtime lifecycle

#### Scenario: Child startup race falls back to discovered authority reuse
- **WHEN** app-server tries to start a local auth-service child runtime
- **AND** the same authority root becomes owned by another healthy auth-service before startup completes
- **THEN** app-server falls back to the discovered runtime descriptor
- **AND** it does not fail the whole boot merely because the authority was already available

#### Scenario: Legacy profileService option remains a compatibility alias
- **WHEN** app-server receives a legacy `profileService` configuration field during the compatibility window
- **THEN** it maps that field to the canonical auth-service runtime options
- **THEN** it does not start both profile-service and auth-service runtimes

### Requirement: Auth-service storage defaults SHALL avoid duplicate durable authorities
New auth-service child runtimes SHALL default to an auth-service storage root and a canonical SQLite store file. The runtime SHALL target exactly one writable auth-service authority root and SHALL NOT reopen an older DuckDB file as a second runtime store.

#### Scenario: Fresh runtime uses auth-service SQLite storage
- **WHEN** app-server starts a fresh local auth-service child runtime
- **THEN** the default data directory is under an auth-service-named path
- **AND** the canonical database filename is `auth-service.sqlite`
