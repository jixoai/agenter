## MODIFIED Requirements

### Requirement: Technical assistant facts SHALL stay available without dominating Chat
The WebUI SHALL keep technical assistant facts, attention activity, and cycle metadata accessible for expert inspection, but those facts MUST NOT dominate the default Chat reading flow and MUST be hidden behind expert affordances such as per-message context menus or explicit navigation to Devtools.

#### Scenario: Internal attention activity is not rendered as the primary chat narrative
- **WHEN** a session contains internal attention items, trace-linked updates, tool-call payloads, or collected technical summaries
- **THEN** those records are not rendered as the primary human-facing conversation narrative in Chat
- **THEN** the user-facing conversation still remains available in chronological order

#### Scenario: Expert attention access remains contextual
- **WHEN** the user opens an expert affordance from Chat for a delivered message
- **THEN** the affordance can expose related Devtools navigation or linked attention/cycle inspection
- **THEN** the default transcript surface still avoids visible attention or cycle terminology
