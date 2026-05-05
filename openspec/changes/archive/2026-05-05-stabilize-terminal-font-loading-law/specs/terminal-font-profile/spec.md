## MODIFIED Requirements

### Requirement: Terminal profiles SHALL expose one durable font profile

Terminal profiles SHALL expose one renderer-neutral font profile owned by terminal-system. The durable font profile MUST include `family`, `sizePx`, `lineHeight`, `letterSpacing`, `weight`, `weightBold`, and `ligatures`.

#### Scenario: Terminal font profile stays declarative while terminal-view owns optional webfont assets
- **WHEN** a caller reads durable terminal config or applies a font mutation
- **THEN** the durable font profile remains a declarative description of the intended family and metrics
- **AND** the profile itself does not encode host-specific asset URLs or CSS preload rules
- **AND** optional webfont asset ownership stays inside `terminal-view`

### Requirement: Terminal font defaults SHALL come from one shared resolver

The system SHALL provide one shared default terminal font resolver so supported renderers start from the same readable and compact font baseline.

#### Scenario: Default terminal font stays renderer-safe and does not force a webfont fetch
- **WHEN** a terminal profile does not override font settings
- **THEN** the resolved default family starts from a literal system monospace stack
- **AND** first paint does not require a webfont request

#### Scenario: Optional terminal webfonts are terminal-view-owned assets
- **WHEN** the durable font profile selects terminal-view-owned webfonts such as `JetBrains Mono`, `IBM Plex Mono`, `Cascadia Mono`, `Source Code Pro`, `Fira Code`, or `Geist Mono`
- **THEN** `terminal-view` resolves that selection into a terminal-owned webfont asset plan
- **AND** browser hosts do not need to preload or globally import those font assets for terminal correctness

#### Scenario: Host font selectors reuse the shared terminal font catalog
- **WHEN** a host surface needs user-selectable terminal font families
- **THEN** it consumes the catalog exported by `terminal-view`
- **AND** it does not duplicate labels, stacks, or asset ownership assumptions in feature-local code
