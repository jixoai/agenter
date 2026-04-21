# session-image-assets Specification

## MODIFIED Requirements

### Requirement: Session image uploads SHALL be validated and persisted per session
The system SHALL accept supported session asset uploads for a specific session only through an authenticated browser authority context, reject unsupported uploads, persist accepted files under that session, and return attachment metadata that can be referenced by chat messages. Supported kinds for this capability are `image`, `video`, and `file`.

#### Scenario: Asset upload succeeds
- **WHEN** an authenticated browser caller uploads one or more supported assets for a session
- **THEN** the system persists them under that session and returns stable asset identifiers plus retrievable media metadata including their asset kind

#### Scenario: Anonymous upload is rejected
- **WHEN** a browser caller uploads session assets without authenticated browser authority
- **THEN** the system rejects the upload with an authorization failure
- **THEN** it does not create attachment records

#### Scenario: Unsupported upload is rejected
- **WHEN** an authenticated browser caller uploads a file whose asset kind is not supported by the session asset contract
- **THEN** the system rejects the upload and does not create attachment records

### Requirement: Stored session images SHALL be retrievable for chat rendering
The system SHALL expose stored session assets through a retrievable media endpoint so the WebUI can render thumbnails, previews, and file metadata for persisted chat attachments, and that endpoint SHALL require authenticated browser authority.

#### Scenario: Chat attachments can be rendered after reload
- **WHEN** an authenticated browser client reloads a session that contains persisted attachments
- **THEN** the chat message data includes enough attachment metadata for the UI to render the appropriate preview or file card and open the stored media content

#### Scenario: Anonymous session asset retrieval is rejected
- **WHEN** a browser caller requests a persisted session asset URL without authenticated browser authority
- **THEN** the media endpoint rejects the request with an authorization failure
- **THEN** persisted session attachments are not anonymously retrievable from the browser control plane
