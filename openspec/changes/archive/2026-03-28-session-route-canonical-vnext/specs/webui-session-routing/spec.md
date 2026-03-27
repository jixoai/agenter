## ADDED Requirements

### Requirement: Session-bound surfaces SHALL use canonical session paths
WebUI session surfaces MUST use path-param session routes and MUST NOT depend on workspace-query session routes.

#### Scenario: Quick Start enters session chats using session path
- **WHEN** user enters or resumes a session from Quick Start
- **THEN** navigation target is `/session/$sessionId/chats`
- **AND** route identity does not depend on `workspacePath/sessionId` search params

#### Scenario: Session tabs keep session-path navigation
- **WHEN** user switches between Chats / Terminals / Settings / Devtools
- **THEN** each tab navigates within `/session/$sessionId/*`
- **AND** workspace context is resolved from session chrome data

### Requirement: Legacy workspace session routes SHALL be retired
The route tree MUST NOT register `/workspace/chat`, `/workspace/terminals`, `/workspace/settings`, or `/workspace/devtools` session pages.

#### Scenario: Router tree only contains session-bound runtime tabs
- **WHEN** app creates the router
- **THEN** session runtime surfaces are only reachable via `/session/$sessionId/*`
