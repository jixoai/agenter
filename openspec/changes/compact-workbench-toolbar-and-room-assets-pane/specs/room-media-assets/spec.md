## MODIFIED Requirements

### Requirement: Room media uploads SHALL be validated and persisted per room

The system SHALL accept supported media uploads for a specific global room, reject unsupported uploads, persist accepted files under that room's durable ownership, and return attachment metadata that can be referenced by room messages. Newly uploaded room assets SHALL also persist uploader identity when that fact is available from the upload authority context.

#### Scenario: Room upload stores uploader identity

- **WHEN** the client uploads one or more supported assets for a room through an authenticated room authority context
- **THEN** the persisted room asset record stores the uploader actor identity when available
- **THEN** later UI projections can display that uploader fact without reverse-inferring it from message history

### Requirement: Stored room media SHALL be listable for room asset browsing

The system SHALL expose a durable room asset listing contract so the WebUI can render a room-local asset pane with file metadata, upload date, uploader, and retrievable media URLs.

#### Scenario: Room assets pane lists persisted uploads

- **WHEN** the operator opens the `assets` room view
- **THEN** the system returns the persisted assets owned by that room ordered for browsing
- **THEN** each item includes enough metadata to render file identity, upload date, uploader, and a retrievable media URL
