## MODIFIED Requirements

### Requirement: Shared room transcript rows SHALL use one shared surface contract

The shared chat package SHALL render room transcript rows with a single message bubble surface, a standard context-menu primitive, and a CodeMirror-based markdown preview for message bodies.

#### Scenario: Viewer-owned room message aligns from durable sender identity
- **WHEN** the transcript renders a message whose `senderActorId` matches the current viewer actor id
- **THEN** the row aligns that message to inline-end
- **THEN** non-owned messages remain inline-start unless they are rendered as assistant/channel rows

#### Scenario: Right click opens a real context menu
- **WHEN** the operator opens a room message context menu
- **THEN** the shared row uses the standard context-menu primitive instead of a dropdown triggered by custom event state

#### Scenario: Message markdown uses CodeMirror preview rendering
- **WHEN** the transcript renders markdown-rich room content
- **THEN** the body uses the shared CodeMirror-based markdown preview renderer
- **THEN** the message row does not wrap that body in a second nested bubble surface

#### Scenario: Read-progress trigger stays at the message inline-end
- **WHEN** the transcript renders a room message with read-progress metadata
- **THEN** the shared row keeps the trigger adjacent to the bubble inline-end for that message
- **THEN** reversing viewer-owned layout does not move the trigger to the opposite side of the bubble
