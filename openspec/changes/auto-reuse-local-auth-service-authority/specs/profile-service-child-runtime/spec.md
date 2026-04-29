## MODIFIED Requirements

### Requirement: App-server SHALL manage auth-service as the canonical child runtime

App-server SHALL manage the auth authority as an auth-service child runtime or external dependency. Profile-service runtime names, package imports, and config keys MAY remain as compatibility aliases only when they resolve to the same auth-service authority. When the target local authority root already exposes a healthy auth-service runtime descriptor, app-server SHALL reuse that local authority instead of starting a second runtime.

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
