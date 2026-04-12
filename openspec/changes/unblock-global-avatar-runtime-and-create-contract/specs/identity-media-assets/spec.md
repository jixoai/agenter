## MODIFIED Requirements

### Requirement: Avatar media SHALL derive fallback artwork from identity seed and classify metadata

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
