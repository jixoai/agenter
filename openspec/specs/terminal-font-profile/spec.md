# terminal-font-profile Specification

## Purpose
TBD - created by archiving change upgrade-terminal-font-profile-and-wterm-stack. Update Purpose after archive.
## Requirements
### Requirement: Terminal profiles SHALL expose one durable font profile

Terminal profiles SHALL expose one renderer-neutral font profile owned by terminal-system. The durable font profile MUST include `family`, `sizePx`, `lineHeight`, `letterSpacing`, `weight`, `weightBold`, and `ligatures`.

#### Scenario: Read terminal font profile
- **WHEN** a caller reads durable terminal config or a projected terminal profile
- **THEN** the result includes one canonical font profile with the shared font fields
- **AND** browser hosts and renderer adapters do not invent separate durable font fields per renderer

#### Scenario: Override one terminal font profile
- **WHEN** a browser-authenticated terminal config mutation updates font settings for one terminal
- **THEN** only that terminal's durable font profile changes
- **AND** unrelated defaults, process profiles, and terminal profiles keep their existing font settings

### Requirement: Renderer stacks SHALL consume the shared font profile through adapter-local mapping

Renderer stacks SHALL consume the shared terminal font profile through adapter-local mapping instead of feature-local CSS or renderer-private host conditionals.

#### Scenario: Xterm-like stacks map the shared font profile to engine options
- **WHEN** the resolved renderer is `xterm`
- **THEN** the adapter maps shared font profile values into renderer option fields such as family, size, line height, and weight
- **AND** host surfaces do not hard-code a second set of terminal font numbers

#### Scenario: Ghostty-web maps only the supported shared font subset
- **WHEN** the resolved renderer is `ghostty-web`
- **THEN** the adapter maps the shared font profile into renderer-supported fields such as family and size
- **AND** browser-font settlement, remeasure, and repaint stay adapter-local
- **AND** unsupported shared subfields do not become fake `ghostty-web` option truth

#### Scenario: WTerm stack maps the shared font profile to CSS variables
- **WHEN** the resolved renderer is `wterm`
- **THEN** the adapter maps the shared font profile into the `WTerm` CSS-variable surface
- **AND** the host still consumes only the shared terminal-view contract instead of writing renderer-specific CSS variables directly

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

#### Scenario: Default font family matches the verified compact baseline
- **WHEN** the current WebUI host uses the shared terminal font default
- **THEN** the default family starts from a literal system monospace stack instead of a webfont-first stack
- **AND** the shared default size is `14px`
- **AND** the shared default line height is `1`

#### Scenario: Optional terminal webfonts remain lazy until used
- **WHEN** WebUI has already injected `@font-face` rules for optional terminal fonts
- **THEN** browser hosts do not treat stylesheet presence as proof that font bytes are already loaded
- **AND** renderer adapters must explicitly wait for browser font readiness before trusting terminal metrics
