## MODIFIED Requirements

### Requirement: App-server SHALL manage profile-service as a child runtime or external dependency

App-server SHALL manage the auth service as a child runtime or an external dependency, and it SHALL bootstrap or discover the root auth identity needed to administer global resources without becoming a second source of truth for auth state.

#### Scenario: App-server starts the child auth service
- **WHEN** app-server boots without an explicit external auth-service endpoint configured
- **THEN** it starts a local auth-service child runtime and loads or creates the configured root auth key material
- **THEN** app-server can discover the child endpoint and root-auth descriptor needed for later admin flows

#### Scenario: App-server exposes bootstrap status without owning the key
- **WHEN** the client asks whether backend-managed root bootstrap is available
- **THEN** app-server returns bootstrap status derived from profile-service
- **THEN** it does not create a second local root-auth store outside profile-service ownership

#### Scenario: App-server proxies explicit root-key generate-or-reveal action
- **WHEN** the client explicitly requests backend generation or reveal of the managed root private key
- **THEN** app-server proxies that request to the auth authority
- **THEN** it does not silently generate or leak the key outside that explicit bootstrap path
