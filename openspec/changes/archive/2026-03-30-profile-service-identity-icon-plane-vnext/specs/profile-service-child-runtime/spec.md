## ADDED Requirements

### Requirement: App-server SHALL manage profile-service as a child runtime or external dependency
The application runtime SHALL be able to start profile-service as a child runtime with its own endpoint and data root, and it SHALL also allow an externally managed profile-service endpoint to be configured instead of spawning the child locally.

#### Scenario: App-server starts the child profile service
- **WHEN** app-server boots without an explicit external profile-service endpoint configured
- **THEN** it starts a local profile-service child runtime
- **AND** app-server can discover the child endpoint for adapter calls and media proxying

#### Scenario: App-server uses an external profile service
- **WHEN** app-server is configured with an external profile-service endpoint
- **THEN** it does not spawn a second local profile-service instance
- **AND** it routes adapter calls to the configured external endpoint instead

### Requirement: Compatibility adapters SHALL preserve semantic owner URLs while delegating authority
App-server and client-facing adapters SHALL preserve semantic URL spaces for session icons and profile/avatar icons while delegating durable authority to profile-service. The adapter layer SHALL NOT reintroduce local icon storage or browser-side fallback rasterization as a second source of truth.

#### Scenario: Existing avatar URL shape remains stable through the adapter
- **WHEN** a client requests an app-server avatar/profile icon URL
- **THEN** app-server resolves that request through profile-service-backed authority
- **AND** the caller does not need to know whether the backing service is local-child or external

#### Scenario: Browser no longer uploads rasterized fallback icons just to persist them
- **WHEN** a session has no uploaded icon asset and a client requests session media
- **THEN** the adapter returns profile-service-backed fallback media directly
- **AND** the browser does not need to generate and upload a synthetic fallback asset first
