## Purpose

Define the primary WebUI navigation and shared master-detail interaction model around Quick Start, Chat, and Workspaces.

## Requirements

### Requirement: Quick Start is a primary application view
The WebUI SHALL expose Quick Start as a dedicated primary view that is separate from Chat and Workspaces, and it SHALL provide the current workspace controls and recent session entry points needed to start work immediately.

#### Scenario: No active session opens on Quick Start
- **WHEN** the application opens without an active session selected
- **THEN** the main content shows the Quick Start view instead of an empty Chat view

#### Scenario: Quick Start shows recent sessions
- **WHEN** recent sessions are available for the selected workspace context
- **THEN** Quick Start shows up to three recent session entries that can be used to resume work

### Requirement: The application SHALL provide stable primary and dynamic chat navigation
The WebUI SHALL render a stable primary navigation for Quick Start, Chat, Workspaces, and Settings, and it SHALL render dynamic chat shortcuts for currently opened sessions.

#### Scenario: Opening a chat session adds a shortcut
- **WHEN** a session is opened in Chat
- **THEN** the sidebar shows a dynamic shortcut for that session with a deterministic workspace avatar and identifying tooltip

#### Scenario: Removing a session clears the shortcut
- **WHEN** an opened session is deleted or archived out of the active workspace
- **THEN** the corresponding dynamic sidebar shortcut is removed

### Requirement: Workspace and session entries SHALL share one interaction contract
The WebUI SHALL use shared WorkspaceItem and SessionItem behaviors everywhere those records are listed, including desktop and mobile layouts.

#### Scenario: Single activation toggles selection
- **WHEN** the user activates the same workspace or session entry twice with a single-click or single-tap gesture
- **THEN** the first activation selects the entry and the second activation clears the selection

#### Scenario: Workspace activation enters its sessions view
- **WHEN** the user double-clicks or double-taps a workspace entry
- **THEN** the application opens that workspace's Sessions auxiliary view without creating a new session

#### Scenario: Session activation resumes chat
- **WHEN** the user double-clicks or double-taps a session entry
- **THEN** the application resumes that session and enters the Chat view

### Requirement: Chat and workspace auxiliary panels SHALL share one master-detail model
The WebUI SHALL use one master-detail interaction model for Chat/Devtools and Workspaces/Sessions, including desktop split behavior and mobile detail presentation.

#### Scenario: Desktop uses a resizable auxiliary panel
- **WHEN** the application is rendered on a desktop-sized viewport
- **THEN** Chat/Devtools and Workspaces/Sessions both use a resizable split layout with the stored width percentage reapplied

#### Scenario: Mobile uses a detail sheet
- **WHEN** the application is rendered on a compact viewport and the user opens an auxiliary panel
- **THEN** the detail content is presented through the shared mobile detail sheet flow instead of a desktop split pane
