# quickstart-avatar-orchestration Specification

## Purpose
Define the durable `Workspaces / Welcome` avatar orchestration flow that replaced standalone Quick Start.

## Requirements

### Requirement: Quick Start SHALL be embedded as the Workspaces Welcome orchestration surface
The WebUI SHALL expose Quick Start through the fixed `Welcome` entry inside `Workspaces`, and that surface SHALL combine session start orchestration with recent workspace or running-avatar context instead of remaining a standalone primary page.

#### Scenario: Welcome opens the start orchestrator
- **WHEN** the user opens `Workspaces` and activates `Welcome`
- **THEN** the surface shows the Avatar start orchestrator and recent context in the same detail view
- **THEN** the user does not need a separate `Quick Start` primary destination

### Requirement: Welcome orchestration SHALL compose avatar, room, terminal, and grant intent before start
The Welcome orchestrator SHALL let the user choose or create an Avatar, pick global room and terminal references, and configure the intended roles or grants for those references before committing a start or attach action.

#### Scenario: User prepares one avatar with room and terminal intent
- **WHEN** the user selects an Avatar and configures target room and terminal references from the Welcome surface
- **THEN** the draft records the chosen avatar, referenced room ids, referenced terminal ids, and role or grant intent
- **THEN** the user can review that launch intent before committing it

#### Scenario: Missing room or terminal can be created elsewhere and resumed
- **WHEN** the user discovers the needed room or terminal does not exist yet
- **THEN** the user can navigate to `Chats` or `Terminals`, create the missing resource, and return to `Welcome`
- **THEN** the Welcome draft remains available so the orchestration can continue

### Requirement: Welcome start SHALL reuse the unique session for the same workspace and avatar
The system SHALL treat `workspace + avatar` as the unique active-session key for Welcome orchestration. Starting the same pair again SHALL focus the existing session instead of creating a duplicate, and any newly requested room or terminal references SHALL be applied as one unified attach intent to that existing session.

#### Scenario: Starting an already running avatar focuses the existing session
- **WHEN** the user starts an avatar that is already running in the same workspace
- **THEN** the application focuses the existing running-avatar detail shell instead of creating a new session
- **THEN** the user sees a committed result rather than a duplicate runtime entry

#### Scenario: Reusing the session can still add new bindings
- **WHEN** the user reuses an existing `workspace + avatar` pair but adds a new room or terminal binding in Welcome
- **THEN** the system applies that binding to the existing session's attachment set
- **THEN** the user does not need to stop and recreate the avatar to attach the new resource

### Requirement: Welcome SHALL derive selectable room and terminal references from current global catalogs
The Welcome surface SHALL derive its room and terminal selection list from the current global room and terminal catalogs in their existing order, and it SHALL allow the user to select or unselect those current refs without introducing a second remembered preset stack inside Welcome.

#### Scenario: Welcome lists current rooms and terminals in source order
- **WHEN** the user opens `Welcome`
- **THEN** the room picker and terminal picker list current global rooms and terminals in the order provided by their source systems
- **THEN** the user can toggle selection state directly from that current list

#### Scenario: Welcome does not require a separate remembered preset list
- **WHEN** the user returns to `Welcome` later
- **THEN** the surface rebuilds its selectable room and terminal list from the current global catalogs plus current attachment state
- **THEN** the user does not need to manage a separate remembered recent or preset stack inside Welcome

### Requirement: Welcome SHALL surface explicit access state for each listed room and terminal
For the currently targeted AvatarSession, the Welcome surface SHALL show whether each listed room or terminal is already joined, merely available, or blocked by a `credential-invalid` local seat credential.

#### Scenario: Invalid credential stays visible as an actionable state
- **WHEN** the target Avatar seat has a stored room or terminal credential that fails validation
- **THEN** the corresponding room or terminal still appears in the Welcome list
- **THEN** the item is not shown as joined and instead exposes an explicit `credential-invalid` state so the user knows reauthorization is required while the stale credential record is still retained
