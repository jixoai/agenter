## MODIFIED Requirements

### Requirement: Terminal processes SHALL expose declarative profile metadata
The terminal control plane SHALL support declarative process profile metadata including `icon`, `title`, `shortcuts`, durable renderer preference, and durable terminal theme identity, and those values SHALL be available to non-AI UI consumers through one canonical config surface. AI-facing runtime config mutation surfaces MUST NOT own renderer/theme mutation authority.

#### Scenario: Read a configured process profile
- **WHEN** a caller inspects terminal config for a known process kind
- **THEN** the response includes the configured `icon`, `title`, `shortcuts`, durable renderer preference, and durable theme identity
- **THEN** a renderer or UI client can derive consistent affordances from that profile

#### Scenario: Override a specific terminal profile
- **WHEN** a system-owned config update changes one process kind or one terminal instance profile
- **THEN** the new profile values override the defaults for that target only
- **THEN** unrelated terminal profiles remain unchanged

#### Scenario: AI-facing config mutation does not own renderer or theme
- **WHEN** an AI-facing runtime tool mutates terminal config
- **THEN** the public mutation surface does not expose renderer preference or theme identity as mutable tool fields
- **AND** those profile facts remain owned by terminal-system durable configuration law
