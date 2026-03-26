## MODIFIED Requirements

### Requirement: Workspace Devtools SHALL own technical session inspection
The WebUI SHALL provide a dedicated Devtools route for technical session inspection, and that route SHALL be addressable by semantic session identity rather than requiring `workspacePath` + `sessionId` query pairing.

#### Scenario: Devtools deep-links by session id
- **WHEN** the user opens Devtools for an existing session
- **THEN** the route path is `/session/$SESSION_ID/devtools`
- **AND** the route can reconstruct the session inspection surface from that session id without requiring `workspacePath` in the URL query

#### Scenario: Devtools route state survives reload
- **WHEN** the user reloads a Devtools deep link
- **THEN** the selected panel and selected technical target are restored from the route state
- **AND** the page does not fall back to an unrelated default selection held only in memory
