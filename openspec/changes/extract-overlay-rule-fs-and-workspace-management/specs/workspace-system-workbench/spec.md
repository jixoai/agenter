## ADDED Requirements

### Requirement: Workspace detail SHALL expose a management dialog for Avatar mounts
The workspace detail surface SHALL expose a dedicated management dialog for the current workspace root. The dialog SHALL manage Avatar mount / unmount state for that workspace instead of pushing this workflow into Avatar detail.

#### Scenario: Open workspace management from workspace detail
- **WHEN** the operator opens the management action from one workspace detail route
- **THEN** the workbench presents a dedicated management dialog for that workspace root
- **AND** the operator does not need to leave `/workspaces` or navigate into Avatar detail to manage mounts

#### Scenario: Mount one avatar to the current workspace
- **WHEN** the operator selects an avatar that is not yet mounted to the current workspace and confirms the action
- **THEN** the workspace is mounted for that avatar
- **AND** the dialog updates to show that avatar as mounted

#### Scenario: Unmount one avatar from the current workspace
- **WHEN** the operator selects a mounted avatar and confirms unmount
- **THEN** the workspace detaches from that avatar's runtime
- **AND** the dialog updates to show that avatar as no longer mounted

### Requirement: Workspace management dialog SHALL stay workspace-centric while coexisting with Explorer, Rules, and Private
The management dialog SHALL treat the current workspace root as the fixed subject and SHALL present Avatar mount state, runtime state, and rule entry points around that one workspace. Explorer, Rules, and Private remain file workflows, not the primary mount-management shell.

#### Scenario: Rules remain the file-permission work surface after management changes
- **WHEN** the operator mounts or unmounts avatars through the management dialog
- **THEN** the main workbench still returns to Explorer, Rules, or Private for file work
- **AND** the dialog does not replace Rules as the primary file-permission editing surface

#### Scenario: Workspace management shows avatar state from the workspace point of view
- **WHEN** the operator scans the dialog list
- **THEN** each row is organized around one avatar's relationship to the current workspace
- **AND** the dialog does not impersonate a global avatar runtime dashboard
