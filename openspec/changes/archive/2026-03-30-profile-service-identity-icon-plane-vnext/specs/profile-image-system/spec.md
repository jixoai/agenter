## MODIFIED Requirements

### Requirement: The system SHALL provide deterministic fallback icons for sessions and avatars
The system SHALL expose stable media endpoints for session icons and profile/avatar icons through profile-service-backed authority. When an uploaded icon asset and any eligible external fallback source are unavailable, those endpoints MUST return deterministic fallback artwork derived from stable owner inputs so the same session or profile identity always renders the same icon.

#### Scenario: Session icon falls back deterministically
- **WHEN** the client requests a session icon for a session that has no uploaded icon asset
- **THEN** the backend returns deterministic fallback artwork derived from that session's workspace identity and session id
- **THEN** repeated requests for the same session return visually stable fallback output

#### Scenario: Profile icon falls back deterministically after higher-priority sources miss
- **WHEN** the client requests a profile/avatar icon that has neither an uploaded asset nor an eligible gravatar result
- **THEN** the backend returns deterministic fallback artwork derived from the resolved profile identity seed
- **THEN** repeated requests for the same identity return visually stable fallback output

### Requirement: The system SHALL allow uploaded icons for sessions and avatars
The system SHALL accept uploaded icon files for sessions and profiles/avatars, persist them as profile-service-owned image assets, and serve those uploaded assets from the same semantic icon endpoints. Backend rasterization and derived variants SHALL be produced server-side rather than requiring browser-side fallback uploads.

#### Scenario: Uploaded session icon overrides fallback
- **WHEN** the client uploads a new icon for a session
- **THEN** the backend persists that icon for the session through profile-service authority
- **THEN** subsequent session icon reads return the uploaded icon instead of the fallback artwork

#### Scenario: Uploaded profile icon overrides gravatar and deterministic fallback
- **WHEN** the client uploads a new icon for a profile/avatar
- **THEN** the backend persists that icon for the profile/avatar
- **THEN** subsequent profile/avatar icon reads return the uploaded icon instead of any gravatar or deterministic fallback source

## REMOVED Requirements

### Requirement: Global settings SHALL expose avatar catalog management
**Reason**: Global settings are no longer limited to a local avatar catalog; durable profile and identifier management now belongs to the global-user-settings capability.
**Migration**: Use the global profile-management surfaces and profile-service-backed APIs defined by `global-user-settings` instead of treating icon management as a local avatar-catalog concern inside the image system spec.
