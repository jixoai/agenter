## ADDED Requirements

### Requirement: The system SHALL provide deterministic fallback icons for sessions and avatars
The system SHALL expose stable media endpoints for session icons and avatar icons. When an uploaded raster or vector icon is unavailable, those endpoints MUST return deterministic fallback artwork derived from stable identity inputs so the same session or avatar always renders the same icon.

#### Scenario: Session icon falls back deterministically
- **WHEN** the client requests a session icon for a session that has no uploaded icon file
- **THEN** the server returns deterministic fallback artwork derived from that session's workspace identity and session id
- **THEN** repeated requests for the same session return visually stable fallback output

#### Scenario: Avatar icon falls back deterministically
- **WHEN** the client requests an avatar icon for an avatar that has no uploaded icon file
- **THEN** the server returns deterministic fallback artwork derived from that avatar identity
- **THEN** repeated requests for the same avatar return visually stable fallback output

### Requirement: The system SHALL allow uploaded icons for sessions and avatars
The system SHALL accept uploaded icon files for sessions and avatars, persist them as profile-image assets, and serve those uploaded assets from the same semantic icon endpoints.

#### Scenario: Uploaded session icon overrides fallback
- **WHEN** the client uploads a new icon for a session
- **THEN** the server persists that icon for the session
- **THEN** subsequent session icon reads return the uploaded icon instead of the fallback artwork

#### Scenario: Uploaded avatar icon overrides fallback
- **WHEN** the client uploads a new icon for an avatar
- **THEN** the server persists that icon for the avatar
- **THEN** subsequent avatar icon reads return the uploaded icon instead of the fallback artwork

### Requirement: Global settings SHALL expose avatar catalog management
The system SHALL expose a global settings surface that can list available avatars, indicate the active avatar, and update avatar profile metadata plus icon uploads without requiring an active session.

#### Scenario: Global settings lists avatars without a session
- **WHEN** the client opens global settings without an active session
- **THEN** the server returns available avatars and the active avatar selection
- **THEN** the UI can manage avatar metadata and icon state without entering a workspace shell
