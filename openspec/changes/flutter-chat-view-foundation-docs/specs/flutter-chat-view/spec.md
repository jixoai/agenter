Define the documentation baseline for the Flutter chat-view package.

## ADDED Requirements

### Requirement: Flutter chat view docs SHALL match the canonical chat transport contract
The Flutter chat-view design docs SHALL describe the same channel ids, websocket transport, and plugin boundary used by the canonical chat system.

#### Scenario: Flutter implementation starts later
- **WHEN** a future engineer begins the Flutter implementation
- **THEN** the package docs already define the transport contract and extension model
- **THEN** they do not need to reverse-engineer the web package to start
