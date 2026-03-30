# profile-service-child-runtime Specification

## Purpose
Define how `app-server` consumes `profile-service` as a child runtime or external dependency without becoming a second canonical owner of profile or icon state.

## Requirements
### Requirement: App-server SHALL manage profile-service as a child runtime or external dependency
The application runtime SHALL be able to start profile-service as a child runtime with its own endpoint and data root, and it SHALL also allow an externally managed profile-service endpoint to be configured instead of spawning the child locally.

#### Scenario: App-server starts the child profile service
- **WHEN** app-server boots without an explicit external profile-service endpoint configured
- **THEN** it starts a local profile-service child runtime
- **AND** app-server can discover the child endpoint for client-facing direct links and control-plane delegation

#### Scenario: App-server uses an external profile service
- **WHEN** app-server is configured with an external profile-service endpoint
- **THEN** it does not spawn a second local profile-service instance
- **AND** it routes adapter calls to the configured external endpoint instead

### Requirement: Compatibility adapters SHALL preserve semantic owner URLs while delegating authority
App-server and client-facing adapters SHALL preserve semantic URL spaces for session icons and profile/avatar icons while delegating durable authority to profile-service. The adapter layer SHALL NOT reintroduce local icon storage, app-server media proxying, or browser-side fallback rasterization as a second source of truth.

#### Scenario: Client receives the discovered profile-service endpoint
- **WHEN** a client connects to app-server
- **THEN** it can query the discovered profile-service endpoint
- **AND** later avatar/session/media URLs resolve against the independent profile-service origin rather than the app-server port

#### Scenario: Session icon fallback no longer depends on caller query params
- **WHEN** app-server creates or resumes a session while profile-service is authoritative for session icons
- **THEN** app-server synchronizes the session icon seed facts into profile-service
- **AND** later clients can request `/media/sessions/:id/icon` from profile-service directly without passing workspace or label query params
