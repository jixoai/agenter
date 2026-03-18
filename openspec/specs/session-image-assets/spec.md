## Purpose

Define the per-session image asset lifecycle and retrieval contract for multimodal chat.

## Requirements

### Requirement: Session image uploads SHALL be validated and persisted per session
The system SHALL accept image uploads for a specific session, reject non-image uploads, persist accepted files under the owning session, and return attachment metadata that can be referenced by chat messages.

#### Scenario: Image upload succeeds
- **WHEN** the client uploads one or more valid image files for a session
- **THEN** the system persists them under that session and returns stable asset identifiers plus retrievable media metadata

#### Scenario: Non-image upload is rejected
- **WHEN** the client uploads a file that is not an image
- **THEN** the system rejects the upload and does not create attachment records

### Requirement: Chat messages SHALL persist attachment references
The system SHALL allow a user chat message to reference previously uploaded session image assets, and those references SHALL be stored with the message block so they can be listed again later.

#### Scenario: Chat send stores attachment references
- **WHEN** the client sends a chat message with one or more uploaded image asset identifiers
- **THEN** the stored chat message includes those attachment references and exposes them when chat messages are listed

### Requirement: Quick Start SHALL preserve image context on first send
The system SHALL allow Quick Start to create a session, upload pending images into that session, and submit the first message with those attachment references as one user flow.

#### Scenario: Quick Start with images creates a session-backed first message
- **WHEN** the user starts a new session from Quick Start with pending images attached
- **THEN** the system creates the session first, uploads the images into that session, and stores the first chat message with the resulting attachment references

### Requirement: Stored session images SHALL be retrievable for chat rendering
The system SHALL expose stored session images through a retrievable media endpoint so the WebUI can render thumbnails and full previews for persisted chat attachments.

#### Scenario: Chat attachments can be rendered after reload
- **WHEN** the client reloads a session that contains image attachments
- **THEN** the chat message data includes enough attachment metadata for the UI to render previews and open the stored image content

### Requirement: Image asset lifecycle SHALL follow the session lifecycle
The system SHALL treat image assets as session-owned records so archive and delete operations keep asset state consistent with the session.

#### Scenario: Archiving keeps image assets with the archived session
- **WHEN** a session with uploaded images is archived
- **THEN** the archived session still retains its image assets and attachment references

#### Scenario: Deleting removes image assets with the session
- **WHEN** a session with uploaded images is permanently deleted
- **THEN** the system removes the session's image assets and attachment references with it
