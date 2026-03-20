## ADDED Requirements

### Requirement: Workspace Chat SHALL present a conversation-first session stage
The WebUI SHALL render the workspace Chat route as a conversation-first stage that prioritizes user messages, assistant replies, and the shared AI input composer over cycle or kernel inspection details.

#### Scenario: Active session opens on a conversation-focused surface
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the primary visible surface is the conversation stream plus the shared AI input composer
- **THEN** workspace chrome remains visually secondary to the conversation stage

#### Scenario: Chat does not default to cycle inspection cards
- **WHEN** the Chat route renders existing session history
- **THEN** it does not present collected-facts summaries, cycle badges, or other cycle-inspection cards as the default reading structure
- **THEN** user-facing chat content remains readable without understanding LoopBus internals

### Requirement: Workspace Chat SHALL expose one primary session action and one actionable status summary
The WebUI SHALL expose exactly one primary session action inside the Chat route, and it SHALL summarize route-relevant runtime state into one actionable notice or passive status instead of stacking multiple competing technical statuses.

#### Scenario: Stopped session offers one clear recovery path
- **WHEN** the active session is stopped
- **THEN** the Chat toolbar shows one primary session control for starting the session
- **THEN** the surrounding status copy explains the most relevant next step without simultaneously repeating multiple raw runtime states

#### Scenario: Route summary prefers actionable guidance over vague fallback errors
- **WHEN** the Chat route receives an unclassified or generic error condition
- **THEN** the route renders a stable user-facing summary instead of the raw text `Unknown error`
- **THEN** the summary either offers a recovery action or explains what part of the session failed in neutral language

### Requirement: Technical assistant facts SHALL stay available without dominating Chat
The WebUI SHALL keep technical assistant facts and cycle metadata accessible for expert inspection, but those facts MUST NOT dominate the default Chat reading flow.

#### Scenario: Internal assistant channels are not rendered as the primary chat narrative
- **WHEN** a session contains internal assistant facts such as attention updates, tool-call payloads, or collected-input summaries
- **THEN** those facts are not rendered as the primary human-facing conversation narrative in Chat
- **THEN** the user-facing conversation still remains available in chronological order
