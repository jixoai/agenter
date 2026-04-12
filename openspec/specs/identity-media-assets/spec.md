# identity-media-assets Specification

## Purpose
Define the semantic media URL contracts for user/profile, session, and typed entity identity assets without leaking which backend owns rendering or persistence.
## Requirements
### Requirement: Session media SHALL provide durable icon upload and fallback retrieval
The system SHALL provide session-specific icon media endpoints that allow clients to upload a durable session icon asset and retrieve either the uploaded asset or a profile-service-generated deterministic fallback icon when no uploaded asset exists. The backend SHALL be able to produce raster variants from the canonical SVG render without relying on browser-side fallback uploads.

#### Scenario: Session icon reads no longer depend on browser-generated fallback uploads
- **WHEN** a session has no uploaded icon asset
- **THEN** the media endpoint returns a deterministic backend-generated fallback icon for that session
- **THEN** the client does not need to upload a browser-rasterized fallback asset before later reads succeed

#### Scenario: Uploaded session icon remains durable
- **WHEN** the client uploads a generated or custom session icon through the session media endpoint
- **THEN** subsequent reads for that session icon return the uploaded asset
- **THEN** the session media owner remains semantically distinct from profile/avatar media

#### Scenario: Session fallback preserves the canonical Agenter renderer
- **WHEN** a caller requests a deterministic session fallback for the same `workspacePath + sessionId + label`
- **THEN** the backend returns the same Agenter-native SVG composition that the product already treats as the canonical session identity artwork
- **THEN** raster outputs are derived from that SVG instead of swapping to a different identicon family

### Requirement: Avatar media SHALL provide backend fallback and override upload
The system SHALL provide profile/avatar media endpoints that allow callers to resolve uploaded assets, gravatar-backed fallbacks when eligible, and deterministic backend fallback artwork from one semantic owner URL family. Uploaded assets SHALL override every lower-priority fallback source.

#### Scenario: Email-backed profile can use gravatar before deterministic fallback
- **WHEN** a client requests a profile/avatar icon for an email-backed profile with no uploaded asset
- **THEN** the backend may resolve a gravatar-backed icon for that email identity
- **THEN** if gravatar is unavailable, the backend returns deterministic fallback artwork for the same profile identity

#### Scenario: Uploaded avatar overrides fallback
- **WHEN** a client uploads an avatar image for a profile/avatar identity
- **THEN** later media reads return the uploaded asset instead of gravatar or deterministic fallback artwork
- **THEN** Chat and settings surfaces can consume the same semantic media URL

#### Scenario: Profile fallback preserves the canonical Agenter renderer
- **WHEN** a caller resolves a temporary or non-gravatar-backed profile/avatar identifier with no uploaded asset
- **THEN** the backend returns the same Agenter-native deterministic SVG style already used as the canonical fallback artwork for that identifier seed
- **THEN** the service does not silently substitute a third-party identicon style

### Requirement: Avatar principal media SHALL derive fallback artwork from identity seed and classify metadata
The system SHALL render default avatar artwork from the managed avatar identity's stable address/principal seed. If AuthSystem metadata includes nullable `classify`, the backend SHALL map it to a canonical lucide-style foreground SVG icon while preserving deterministic seed-driven background art.

#### Scenario: Same avatar identity resolves the same fallback artwork
- **WHEN** a caller requests fallback media for the same avatar principal multiple times without an uploaded asset
- **THEN** the backend returns the same deterministic artwork each time for that identity seed
- **AND** the caller does not need to upload a browser-generated placeholder first

#### Scenario: Classify metadata adds a foreground glyph without replacing identity seed
- **WHEN** avatar metadata sets `classify` to a supported enum value
- **THEN** the backend overlays the mapped foreground SVG icon on top of the deterministic identity-seeded fallback artwork
- **AND** when `classify` is null, fallback rendering still succeeds without requiring a foreground icon

#### Scenario: Uploaded avatar asset still overrides generated fallback
- **WHEN** an avatar identity has an uploaded icon asset
- **THEN** later media reads return the uploaded asset instead of the generated fallback
- **AND** `classify` remains metadata for fallback rendering rather than a replacement for uploaded artwork

### Requirement: Session and avatar media SHALL remain semantically separated
The system SHALL keep session icon media and profile/avatar media in separate semantic URL spaces even when both are served by profile-service. Callers MUST be able to distinguish session identity assets from user/profile identity assets without inspecting implementation details.

#### Scenario: Client resolves different media owners
- **WHEN** the client requests Session icon media and Profile/Avatar media
- **THEN** those requests use different semantic URL patterns
- **THEN** the caller can distinguish session identity assets from user/profile identity assets without inspecting implementation details

### Requirement: Typed entity icon media SHALL remain semantically separated
The media system SHALL keep typed entity icon owners in separate semantic URL spaces even when one backend authority serves them. Room icon media SHALL use a distinct semantic URL family from session and profile/avatar media, and future typed owners SHALL follow the same rule.

#### Scenario: Room icon URL stays distinct from session and profile media
- **WHEN** the client resolves icon URLs for a room, a session, and a profile
- **THEN** each request uses a distinct semantic URL pattern for its owner type
- **THEN** the caller can distinguish room identity media from session or profile media without inspecting implementation details

#### Scenario: Typed entity icons do not collapse into a generic bucket
- **WHEN** a new typed icon owner is introduced
- **THEN** its media reads and writes remain under an owner-specific semantic URL family
- **THEN** the system does not expose a single untyped icon bucket that hides ownership semantics
