# profile-image-system Specification

## Purpose
Define the shared deterministic icon system for sessions, durable profiles, and typed entity owners such as rooms, including upload precedence and backend-rendered fallback behavior.
## Requirements
### Requirement: The system SHALL provide deterministic fallback icons for sessions and avatars
The system SHALL expose stable media endpoints for session icons and profile/avatar icons through profile-service-backed authority. When an uploaded icon asset and any eligible external fallback source are unavailable, those endpoints MUST return deterministic fallback artwork derived from stable owner inputs so the same session or profile identity always renders the same icon. When the canonical source is SVG-backed, the default media response MUST be rasterized server-side through a packaged multi-platform resvg runtime such as `@resvg/resvg-js` instead of leaking raw SVG by default or depending on a repo-local bridge asset.

#### Scenario: Session icon falls back deterministically
- **WHEN** the client requests a session icon for a session that has no uploaded icon file
- **THEN** the server returns deterministic fallback artwork derived from that session's synchronized workspace identity seed and session id
- **THEN** repeated requests for the same session return visually stable fallback output

#### Scenario: Default icon reads are rasterized through the packaged runtime even when the canonical source is SVG
- **WHEN** the client requests a session or profile icon without an explicit `format`
- **THEN** SVG-backed fallbacks and uploaded SVGs are rasterized server-side through the packaged resvg runtime
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

### Requirement: The system SHALL provide deterministic fallback icons for typed entity owners
The icon system SHALL support typed entity owners in addition to sessions and profiles. Room icons SHALL be the first additional typed owner, and the same typed owner model SHALL remain available for future entities such as terminals or tasks. When an uploaded icon is absent, each typed owner MUST resolve deterministic fallback artwork from a stable owner-specific seed through the same backend-rendered authority.

#### Scenario: Room icon falls back deterministically
- **WHEN** the client requests a room icon for a room that has no uploaded icon asset
- **THEN** the backend returns deterministic fallback artwork derived from that room's stable icon seed
- **THEN** repeated requests for the same room return visually stable fallback output

#### Scenario: Future typed owners reuse the same authority model
- **WHEN** the platform introduces another typed owner such as a terminal or task
- **THEN** that owner can resolve icon fallback through the same typed icon authority contract
- **THEN** the system does not require a second ad hoc icon service for that entity family

### Requirement: The system SHALL allow uploaded icons for typed entity owners
The icon system SHALL allow room and future typed entity owners to persist uploaded icons through the canonical icon authority, and those uploaded assets SHALL override deterministic fallback output from the same semantic owner URL.

#### Scenario: Uploaded room icon overrides fallback
- **WHEN** an authorized caller uploads a new icon for a room
- **THEN** the backend persists that icon for the room owner
- **THEN** subsequent room icon reads return the uploaded icon instead of deterministic fallback artwork

### Requirement: Default raster icon delivery SHALL not depend on a repo-local bridge build

Supported hosts SHALL be able to rasterize SVG-backed profile and session icons from package installation alone. The default runtime path MUST NOT require a repo-local Cargo build output, a manually supplied bridge library path, or a checked-out native source tree to serve the canonical raster media response.

#### Scenario: Fresh install can serve raster icons without building a bridge
- **GIVEN** a supported release install of Agenter and auth-service
- **WHEN** the first SVG-backed icon request asks for the default raster response
- **THEN** the server resolves the packaged raster runtime from installed dependencies
- **AND** it does not need to compile or discover `libprofile_resvg_bridge.*` at request time

#### Scenario: Unsupported host fails with runtime clarity
- **GIVEN** a host that is outside the supported packaged raster matrix
- **WHEN** the server cannot resolve a compatible packaged raster runtime
- **THEN** startup or request handling fails with a clear unsupported-runtime error
- **AND** the system does not silently claim SVG raster support that is not actually available
