## ADDED Requirements

### Requirement: Runtime bootstrap SHALL not imply workspace mounts or root grants
WorkspaceSystem SHALL treat runtime workspace access as an explicit durable mount/grant fact. Session creation, runtime start, and bootstrap `cwd` metadata MUST NOT auto-attach a workspace or silently inject a root `rw` grant.

#### Scenario: Session creation does not auto-mount bootstrap workspace
- **WHEN** app-server creates a session with a bootstrap workspace path
- **THEN** the runtime does not gain workspace access until code explicitly mounts and grants that workspace
- **AND** `session.cwd` or `session.workspacePath` remains metadata rather than permission

#### Scenario: Runtime restart restores only persisted workspace mounts
- **WHEN** a runtime restarts after one or more workspace mounts were explicitly granted earlier
- **THEN** recovery uses the persisted mount and grant records from WorkspaceSystem
- **AND** it does not recreate missing mounts or root grants just because the session has a bootstrap workspace path

