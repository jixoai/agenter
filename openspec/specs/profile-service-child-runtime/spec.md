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
