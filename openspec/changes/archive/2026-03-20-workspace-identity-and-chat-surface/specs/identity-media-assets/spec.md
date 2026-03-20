## ADDED Requirements

### Requirement: Session media SHALL provide durable icon upload and fallback retrieval
The system SHALL provide session-specific icon media endpoints that allow clients to upload a rasterized icon asset and retrieve either the uploaded asset or a deterministic fallback icon when no uploaded asset exists.

#### Scenario: Client uploads a generated session icon
- **WHEN** the client generates a Session icon for a session identifier
- **THEN** it can upload that icon through a session media endpoint using `image/webp`
- **THEN** subsequent reads for that Session icon return the uploaded asset

#### Scenario: Session icon falls back deterministically
- **WHEN** a session has no uploaded icon asset
- **THEN** the media endpoint returns a deterministic fallback icon for that session
- **THEN** the fallback remains stable for the same workspace and session seeds

### Requirement: Avatar media SHALL provide backend fallback and override upload
The system SHALL provide avatar media endpoints that return a deterministic backend-generated SVG fallback and allow clients to override that fallback by uploading a custom avatar image.

#### Scenario: Avatar without upload returns backend SVG fallback
- **WHEN** a client requests an avatar icon for an avatar identity that has no uploaded asset
- **THEN** the server returns a deterministic SVG fallback for that avatar
- **THEN** the fallback remains stable for the same avatar identity

#### Scenario: Uploaded avatar overrides fallback
- **WHEN** a client uploads an avatar image for an avatar identity
- **THEN** later avatar media reads return the uploaded asset instead of the fallback SVG
- **THEN** Chat and settings surfaces can consume the same semantic media URL

### Requirement: Session and avatar media SHALL remain semantically separated
The system SHALL keep session icon media and avatar media in separate semantic URL spaces and MUST NOT collapse them into one ambiguous media namespace.

#### Scenario: Client resolves different media owners
- **WHEN** the client requests Session icon media and Avatar media
- **THEN** those requests use different semantic URL patterns
- **THEN** the caller can distinguish session identity assets from user/avatar identity assets without inspecting implementation details
