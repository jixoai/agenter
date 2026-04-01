# profile-image-system Specification

## Purpose
Define the shared deterministic icon system for sessions and durable profiles, including upload precedence and backend-rendered fallback behavior.
## Requirements
### Requirement: The system SHALL provide deterministic fallback icons for sessions and avatars
The system SHALL expose stable media endpoints for session icons and profile/avatar icons through profile-service-backed authority. When an uploaded icon asset and any eligible external fallback source are unavailable, those endpoints MUST return deterministic fallback artwork derived from stable owner inputs so the same session or profile identity always renders the same icon. When the canonical source is SVG-backed, the default media response MUST be rasterized server-side instead of leaking raw SVG by default.

#### Scenario: Session icon falls back deterministically
- **WHEN** the client requests a session icon for a session that has no uploaded icon file
- **THEN** the server returns deterministic fallback artwork derived from that session's synchronized workspace identity seed and session id
- **THEN** repeated requests for the same session return visually stable fallback output

#### Scenario: Default icon reads are rasterized even when the canonical source is SVG
- **WHEN** the client requests a session or profile icon without an explicit `format`
- **THEN** SVG-backed fallbacks and uploaded SVGs are rasterized by profile-service through resvg
- **AND** the response content-type is a raster image type instead of `image/svg+xml`

#### Scenario: Profile icon falls back deterministically after higher-priority sources miss
- **WHEN** the client requests a profile/avatar icon that has neither an uploaded asset nor an eligible gravatar result
- **THEN** the backend returns deterministic fallback artwork derived from the resolved profile identity seed
- **THEN** repeated requests for the same identity return visually stable fallback output

### Requirement: Deterministic fallback icons SHALL render correctly through the default raster path
Profile and session fallback icons SHALL remain visibly colored and readable when served through the default raster media path.

#### Scenario: Default fallback avatar is not blacked out
- **WHEN** the client requests a default profile or session icon without forcing SVG
- **THEN** the returned raster image contains usable colored fallback artwork
- **AND** the caller does not need a special query parameter to avoid a black avatar

### Requirement: The system SHALL allow uploaded icons for sessions and avatars
The system SHALL accept uploaded icon files for sessions and profiles/avatars, persist them as profile-service-owned image assets, and serve those uploaded assets from the same semantic icon endpoints. Backend rasterization and derived variants SHALL be produced server-side rather than requiring browser-side fallback uploads.

#### Scenario: Uploaded session icon overrides fallback
- **WHEN** the client uploads a new icon for a session
- **THEN** the server persists that icon for the session
- **THEN** subsequent session icon reads return the uploaded icon instead of the fallback artwork

#### Scenario: Uploaded profile icon overrides gravatar and deterministic fallback
- **WHEN** the client uploads a new icon for a profile/avatar
- **THEN** the backend persists that icon for the profile/avatar
- **THEN** subsequent profile/avatar icon reads return the uploaded icon instead of any gravatar or deterministic fallback source
