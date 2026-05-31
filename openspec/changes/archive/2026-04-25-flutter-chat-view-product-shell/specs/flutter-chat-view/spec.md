## ADDED Requirements

### Requirement: Flutter chat view SHALL compose as a host-owned conversation stage
The Flutter chat package SHALL expose chat-stage primitives that a host-owned app shell can compose without inheriting route chrome, connection forms, or app-level navigation from the package itself. The package SHALL keep room transport, transcript, composer, and row affordances inside the stage boundary while leaving profile management, shell navigation, and room-detail orchestration to the host shell.

#### Scenario: Host shell owns app chrome around the chat stage
- **WHEN** a standalone Flutter app shell embeds the chat stage
- **THEN** the package provides the conversation viewport and composer surface without forcing a second package-owned page header
- **THEN** the host shell remains free to place its own navigation, status chrome, and detail surfaces around that stage

### Requirement: Flutter chat view SHALL expose app-grade transcript affordances
The Flutter chat stage SHALL render a conversation-first transcript with restrained time dividers, message selection, and a return-to-latest affordance so a host shell can deliver long-lived room browsing without reverting to demo-style flat rendering.

#### Scenario: Transcript shows restrained time dividers
- **WHEN** adjacent room messages cross a meaningful time or date boundary
- **THEN** the chat stage inserts a visually secondary time divider into the transcript
- **THEN** the divider does not dominate the message reading order

#### Scenario: Operator can recover latest after browsing older history
- **WHEN** the operator scrolls away from the newest transcript edge
- **THEN** the stage exposes a return-to-latest affordance
- **THEN** activating that affordance brings the operator back to the newest visible room messages

#### Scenario: Host can project selected message detail
- **WHEN** the operator selects a transcript row
- **THEN** the chat stage exposes that selected message through an explicit callback or selection surface
- **THEN** the host shell can render message-local detail without replacing the transcript renderer
