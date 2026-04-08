## ADDED Requirements

### Requirement: Room media uploads SHALL be validated and persisted per room
The system SHALL accept supported media uploads for a specific global room, reject unsupported uploads, persist accepted files under that room's durable ownership, and return attachment metadata that can be referenced by room messages. Supported kinds for this capability are `image`, `video`, and `file`.

#### Scenario: Room media upload succeeds
- **WHEN** the client uploads one or more supported assets for a room
- **THEN** the system persists them under that room and returns stable asset identifiers plus retrievable media metadata including their asset kind

#### Scenario: Unsupported room media upload is rejected
- **WHEN** the client uploads a file whose asset kind is not supported by the room asset contract
- **THEN** the system rejects the upload and does not create room attachment records

### Requirement: Stored room media SHALL be retrievable for room transcript rendering
The system SHALL expose stored room assets through retrievable media endpoints so WebUI can render thumbnails, previews, and file metadata for persisted room attachments.

#### Scenario: Room attachments render after reload
- **WHEN** the client reloads a room that contains persisted room attachments
- **THEN** the room message data includes enough attachment metadata for the UI to render the appropriate preview or file card and open the stored media content

### Requirement: Room media lifecycle SHALL follow the room lifecycle
The system SHALL treat room assets as room-owned durable records so archive and delete operations keep room media state consistent with the room lifecycle.

#### Scenario: Archiving keeps room assets with the archived room
- **WHEN** a room with uploaded assets is archived
- **THEN** the archived room still retains its asset files and attachment references

#### Scenario: Deleting removes room assets with the room
- **WHEN** a room with uploaded assets is permanently deleted
- **THEN** the system removes that room's asset files and attachment references with it
