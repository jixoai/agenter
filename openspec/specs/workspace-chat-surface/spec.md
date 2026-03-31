# workspace-chat-surface Specification

## Purpose
Define the durable boundary between global conversation browsing and workspace or running-avatar runtime surfaces.

## Requirements

### Requirement: Workspace runtime shells SHALL defer conversation browsing to global Chats
The `Workspaces` surface and running-avatar runtime detail shell SHALL not own the primary room-browsing experience. Global room-first `Chats` SHALL remain the conversation browsing surface, while workspace and runtime shells focus on orchestration, runtime inspection, and source jumps.

#### Scenario: Runtime detail links out to global Chats
- **WHEN** the user requests room inspection from a running-avatar detail shell
- **THEN** the application navigates to the global `Chats` surface
- **THEN** the runtime shell does not render a duplicate embedded room browser

#### Scenario: Workspaces stays focused on orchestration instead of transcript browsing
- **WHEN** the user opens `Workspaces`
- **THEN** the detail surface prioritizes `Welcome`, `History`, `Settings`, and `Avatars`
- **THEN** conversation-first browsing remains a responsibility of the global `Chats` page
