## MODIFIED Requirements

### Requirement: Workspace Chat SHALL present a conversation-first session stage
The WebUI SHALL render the workspace Chat route as a conversation-first stage that prioritizes user messages, assistant replies, and the shared AI input composer over cycle or kernel inspection details.

#### Scenario: Active session opens on a conversation-focused surface
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the primary visible surface is the chronological conversation stream plus the shared AI input composer
- **THEN** the Chat surface does not render cycle rails, cycle badges, or cycle section headers as the default reading structure
- **THEN** workspace chrome remains visually secondary to the conversation stage

#### Scenario: Chat does not default to cycle inspection cards
- **WHEN** the Chat route renders existing session history on desktop or compact layouts
- **THEN** it does not present collected-facts summaries, cycle badges, or other cycle-inspection cards as the default reading structure
- **THEN** user-facing chat content remains readable without understanding LoopBus internals

### Requirement: Technical assistant facts SHALL stay available without dominating Chat
The WebUI SHALL keep technical assistant facts and cycle metadata accessible for expert inspection, but those facts MUST NOT dominate the default Chat reading flow.

#### Scenario: Internal assistant channels are not rendered as the primary chat narrative
- **WHEN** a session contains internal assistant facts such as attention updates, tool-call payloads, or collected-input summaries
- **THEN** those facts are not rendered as the primary human-facing conversation narrative in Chat
- **THEN** the user-facing conversation still remains available in chronological order

#### Scenario: Cycle inspection is reached through explicit advanced actions
- **WHEN** the user wants to inspect the technical cycle related to a visible chat message
- **THEN** Chat exposes that path through an explicit advanced action such as a menu button, context menu, or long-press menu
- **THEN** cycle-oriented inspection remains inside Devtools instead of appearing as persistent primary Chat chrome

## ADDED Requirements

### Requirement: Workspace Chat SHALL publish user-visible turns immediately
The WebUI SHALL publish visible conversation turns as soon as the user or assistant produces them, instead of waiting for a later cycle-level projection to finish.

#### Scenario: Submitted user message appears immediately
- **WHEN** the user submits a message from the Chat composer
- **THEN** the Chat surface shows an optimistic user row immediately in the conversation stream

#### Scenario: Assistant reply streams in place
- **WHEN** the active assistant response is still streaming
- **THEN** the Chat surface updates the visible assistant row in place as streaming content arrives
- **THEN** it does not wait for a completed cycle summary before rendering the reply
