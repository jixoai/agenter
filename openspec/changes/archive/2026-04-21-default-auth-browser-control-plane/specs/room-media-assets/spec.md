# room-media-assets Specification

## MODIFIED Requirements

### Requirement: Room media uploads SHALL be validated and persisted per room
The system SHALL accept supported media uploads for a specific global room only through an authenticated browser authority context, reject unsupported uploads, persist accepted files under that room's durable ownership, and return attachment metadata that can be referenced by room messages. Supported kinds for this capability are `image`, `video`, and `file`. Newly uploaded room assets SHALL also persist uploader identity when that fact is available from the authenticated upload authority context.

#### Scenario: Room media upload succeeds
- **WHEN** an authenticated browser caller uploads one or more supported assets for a room
- **THEN** the system persists them under that room and returns stable asset identifiers plus retrievable media metadata including their asset kind

#### Scenario: Anonymous room media upload is rejected
- **WHEN** a browser caller uploads assets for a room without authenticated browser authority
- **THEN** the system rejects the upload with an authorization failure
- **THEN** it does not create room attachment records even if a room credential is otherwise present

#### Scenario: Unsupported room media upload is rejected
- **WHEN** an authenticated browser caller uploads a file whose asset kind is not supported by the room asset contract
- **THEN** the system rejects the upload and does not create room attachment records

#### Scenario: Room upload stores uploader identity
- **WHEN** an authenticated browser caller uploads one or more supported assets for a room through an authenticated room authority context
- **THEN** the persisted room asset record stores the uploader actor identity when available
- **THEN** later UI projections can display that uploader fact without reverse-inferring it from message history

### Requirement: Stored room media SHALL be retrievable for room transcript rendering
The system SHALL expose stored room assets through retrievable media endpoints so WebUI can render thumbnails, previews, and file metadata for persisted room attachments, and those endpoints SHALL require authenticated browser authority plus the corresponding room-scoped access semantics.

#### Scenario: Room attachments render after reload
- **WHEN** an authenticated browser client reloads a room that contains persisted room attachments
- **THEN** the room message data includes enough attachment metadata for the UI to render the appropriate preview or file card and open the stored media content

#### Scenario: Anonymous room media retrieval is rejected
- **WHEN** a browser caller requests a persisted room asset URL without authenticated browser authority
- **THEN** the media endpoint rejects the request with an authorization failure
- **THEN** persisted room attachments are not anonymously retrievable from the browser control plane
