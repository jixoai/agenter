## MODIFIED Requirements

### Requirement: Deterministic fallback icons SHALL render correctly through the default raster path

Profile and session fallback icons SHALL remain visibly colored and readable when served through the default raster media path.

#### Scenario: Default fallback avatar is not blacked out
- **WHEN** the client requests a default profile or session icon without forcing SVG
- **THEN** the returned raster image contains usable colored fallback artwork
- **AND** the caller does not need a special query parameter to avoid a black avatar
