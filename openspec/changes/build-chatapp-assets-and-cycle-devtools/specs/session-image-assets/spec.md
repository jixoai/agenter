## MODIFIED Requirements

### Requirement: Session image uploads SHALL be validated and persisted per session
The system SHALL accept supported session asset uploads for a specific session, reject unsupported uploads, persist accepted files under that session, and return attachment metadata that can be referenced by chat messages. Supported kinds for this capability are `image`, `video`, and `file`.

#### Scenario: Asset upload succeeds
- **WHEN** the client uploads one or more supported assets for a session
- **THEN** the system persists them under that session and returns stable asset identifiers plus retrievable media metadata including their asset kind

#### Scenario: Unsupported upload is rejected
- **WHEN** the client uploads a file whose asset kind is not supported by the session asset contract
- **THEN** the system rejects the upload and does not create attachment records

### Requirement: Chat messages SHALL persist attachment references
The system SHALL allow a user chat message to reference previously uploaded session asset identifiers, and those references SHALL be stored with the message block so they can be listed again later.

#### Scenario: Chat send stores attachment references
- **WHEN** the client sends a chat message with one or more uploaded session asset identifiers
- **THEN** the stored chat message includes those attachment references and exposes them when chat messages are listed

### Requirement: Quick Start SHALL preserve image context on first send
The system SHALL allow Quick Start to create a session, upload pending session assets into that session, and submit the first message with those attachment references as one user flow.

#### Scenario: Quick Start with pending assets creates a session-backed first message
- **WHEN** the user starts a new session from Quick Start with pending attachments
- **THEN** the system creates the session first, uploads the pending assets into that session, and stores the first chat message with the resulting attachment references

### Requirement: Stored session images SHALL be retrievable for chat rendering
The system SHALL expose stored session assets through a retrievable media endpoint so the WebUI can render thumbnails, previews, and file metadata for persisted chat attachments.

#### Scenario: Chat attachments can be rendered after reload
- **WHEN** the client reloads a session that contains persisted attachments
- **THEN** the chat message data includes enough attachment metadata for the UI to render the appropriate preview or file card and open the stored media content

### Requirement: Image asset lifecycle SHALL follow the session lifecycle
The system SHALL treat session assets as session-owned records so archive and delete operations keep asset state consistent with the session.

#### Scenario: Archiving keeps session assets with the archived session
- **WHEN** a session with uploaded assets is archived
- **THEN** the archived session still retains its asset files and attachment references

#### Scenario: Deleting removes session assets with the session
- **WHEN** a session with uploaded assets is permanently deleted
- **THEN** the system removes the session's asset files and attachment references with it
