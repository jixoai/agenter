## MODIFIED Requirements

### Requirement: Terminal processes SHALL expose declarative profile metadata

The terminal control plane SHALL support declarative process profile metadata including `icon`, `title`, `shortcuts`, durable renderer preference, durable terminal theme identity, durable cursor style, and durable terminal font profile, and those values SHALL be available to non-AI UI consumers through one canonical config surface. AI-facing runtime config mutation surfaces MUST NOT own renderer/theme/cursor/font mutation authority.

#### Scenario: Read a configured process profile
- **WHEN** a caller inspects terminal config for a known process kind
- **THEN** the response includes the configured `icon`, `title`, `shortcuts`, durable renderer preference, durable theme identity, durable cursor style, and durable font profile
- **THEN** a renderer or UI client can derive consistent presentation behavior from that profile

#### Scenario: Override a specific terminal profile
- **WHEN** a system-owned or browser-authenticated config update changes one process kind or one terminal instance profile
- **THEN** the new profile values override the defaults for that target only
- **THEN** unrelated terminal profiles remain unchanged

#### Scenario: AI-facing config mutation does not own presentation profile
- **WHEN** an AI-facing runtime tool mutates terminal config
- **THEN** the public mutation surface does not expose renderer preference, theme identity, cursor style, or font profile as mutable tool fields
- **AND** those profile facts remain owned by terminal-system durable configuration law

## ADDED Requirements

### Requirement: Browser-authenticated terminal config mutation SHALL update durable presentation profile

Browser-authenticated terminal config mutation SHALL allow `rendererPreference`, `theme`, `cursor`, and `font` updates on global terminals while keeping AI-facing runtime mutation excluded from those fields.

#### Scenario: Global terminal config updates theme and font
- **WHEN** an authenticated browser operator applies a terminal presentation change for one terminal id
- **THEN** terminal-system persists the updated `rendererPreference`, `theme`, `cursor`, or `font` value for that terminal
- **AND** the next terminal config read returns the same durable presentation profile

#### Scenario: Live presentation updates keep terminal identity stable
- **WHEN** a running terminal updates theme, cursor, font, or renderer preference
- **THEN** the visible viewport may restyle or rebuild its local renderer stack
- **AND** the durable terminal id and PTY identity remain unchanged
