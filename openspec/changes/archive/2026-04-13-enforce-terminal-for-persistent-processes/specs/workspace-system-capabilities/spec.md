## MODIFIED Requirements

### Requirement: WorkspaceSystem SHALL reserve persistent processes for terminal sessions
One-shot workspace bash execution SHALL reject background shell statements instead of pretending to host durable processes. Long-running services and other persistent processes SHALL be created and recovered through TerminalSystem.

#### Scenario: Root workspace bash rejects background service startup
- **WHEN** the AI runs `node server.js > server.log 2>&1 &` through `root_workspace_bash`
- **THEN** the execution exits non-zero before accepting that background statement as valid delivery flow
- **AND** stderr tells the caller to create or recover a terminal for long-running work

#### Scenario: Workspace bash rejects background service startup
- **WHEN** the AI runs `python3 -m http.server 4173 --bind 127.0.0.1 &` through workspace bash
- **THEN** the execution exits non-zero
- **AND** the caller is redirected toward the terminal workflow instead of relying on one-shot bash persistence
