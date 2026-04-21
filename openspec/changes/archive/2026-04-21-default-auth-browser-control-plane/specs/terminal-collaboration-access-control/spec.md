# terminal-collaboration-access-control Specification

## ADDED Requirements

### Requirement: Browser auth SHALL gate global terminal control-plane routes before terminal grants apply
Browser-facing global terminal routes SHALL require an authenticated browser auth session before they evaluate terminal grants, seat tokens, approval requests, or superadmin recovery authority.

#### Scenario: Terminal seat token alone cannot bypass browser auth
- **WHEN** a browser caller invokes a global terminal route with a valid seat token or terminal grant but without a valid browser bearer token
- **THEN** the daemon rejects the request with `UNAUTHORIZED`
- **THEN** terminal-scoped credentials do not reopen anonymous browser access to the control plane

#### Scenario: Authenticated browser caller still uses terminal-scoped authority
- **WHEN** a browser caller invokes a global terminal route with a valid browser bearer token
- **THEN** the daemon continues evaluating terminal grants, seat tokens, approval requests, or superadmin recovery authority for that terminal
- **THEN** browser auth identifies the operator while terminal authority remains resource-scoped
