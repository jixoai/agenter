## ADDED Requirements

### Requirement: Workspace Chat SHALL stay message-channel-first
Workspace Chat MUST render only message-channel rows and MUST not render technical tool invocation transcript blocks.

#### Scenario: Technical tool traces remain outside Chat
- **WHEN** a cycle emits tool call/result technical records
- **THEN** those records are not rendered in Workspace Chat transcript
- **THEN** technical inspection remains available through Devtools technical panels
