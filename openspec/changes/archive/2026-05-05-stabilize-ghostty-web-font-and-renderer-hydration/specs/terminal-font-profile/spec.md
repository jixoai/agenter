## MODIFIED Requirements

### Requirement: Terminal font defaults SHALL come from one shared resolver

The system SHALL provide one shared default terminal font resolver so supported renderers start from the same readable and compact font baseline.

#### Scenario: Default font profile resolves consistently
- **WHEN** a terminal profile does not override font settings
- **THEN** the viewport resolves one shared default terminal font profile
- **AND** supported renderers start from the same compact family, size, and line-height baseline instead of feature-local magic numbers

#### Scenario: Default font family stays renderer-safe outside WebUI CSS
- **WHEN** `terminal-view` resolves the default terminal font profile in a host that does not provide WebUI-local CSS variables
- **THEN** the default font family still resolves to a usable literal monospace stack
- **AND** renderer adapters do not depend on `var(--font-mono)` being understood inside third-party JS option parsing

#### Scenario: Default font family starts from the system mono baseline
- **WHEN** the current WebUI host uses the shared terminal font default
- **THEN** the default family starts from a literal system monospace stack instead of a webfont-first stack
- **AND** the default path does not require a font download before first usable render
- **AND** the default size stays `14px` with shared `lineHeight: 1`

#### Scenario: Optional webfonts stay lazy until a renderer actually uses them
- **WHEN** WebUI has already injected an `@font-face` for an optional terminal font such as `JetBrains Mono`
- **THEN** browser hosts do not assume that stylesheet presence means the font is already downloaded
- **AND** renderer adapters must explicitly wait for browser font readiness before trusting first metrics
