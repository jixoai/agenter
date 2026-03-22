## ADDED Requirements

### Requirement: Terminal processes SHALL expose declarative profile metadata
The terminal control plane SHALL support declarative process profile metadata including `icon`, `title`, and `shortcuts`, and those values SHALL be available to AI and UI consumers through one canonical config surface.

#### Scenario: Read a configured process profile
- **WHEN** a caller inspects terminal config for a known process kind
- **THEN** the response includes the configured `icon`, `title`, and `shortcuts`
- **THEN** a renderer or AI client can derive consistent affordances from that profile

#### Scenario: Override a specific terminal profile
- **WHEN** a caller updates config for one process kind or one terminal instance
- **THEN** the new profile values override the defaults for that target only
- **THEN** unrelated terminal profiles remain unchanged
