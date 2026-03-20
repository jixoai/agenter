## ADDED Requirements

### Requirement: WebUI overflow roles SHALL use explicit surface contracts
The WebUI SHALL distinguish layout containment, scrolling, visual clipping, and animation masking as separate surface roles. Layout wrappers MUST NOT use raw `overflow-hidden` unless they are implemented through an approved overflow primitive.

#### Scenario: Layout wrapper uses the explicit contract
- **WHEN** a WebUI shell or panel wrapper needs to size descendants without clipping them
- **THEN** it does not use raw `overflow-hidden`
- **THEN** scrolling and clipping are delegated to explicit child surfaces

#### Scenario: Visual clipping remains deliberate
- **WHEN** a surface needs rounded-corner or viewport clipping for media, terminal chrome, or similar presentational content
- **THEN** it uses an approved clipping primitive instead of a raw layout wrapper class

### Requirement: WebUI panels SHALL expose one primary scroll viewport
Each major WebUI application surface SHALL provide exactly one deliberate primary scroll container for its main content region, while headers, tabs, and fixed controls remain outside that viewport.

#### Scenario: Panel with long content remains operable
- **WHEN** a panel contains content taller than the available viewport
- **THEN** the panel exposes a single primary scroll viewport for that content
- **THEN** the panel header and fixed controls remain visible outside the scrolling region

#### Scenario: Nested wrappers do not compete for scrolling
- **WHEN** the panel is composed from shell, async, and content wrappers
- **THEN** only the designated primary scroll viewport owns scrolling for the main content area
- **THEN** ancestor layout wrappers do not introduce competing hidden or auto overflow behavior

### Requirement: Raw overflow-hidden usage SHALL be statically enforceable
The WebUI source tree SHALL fail contract verification if raw `overflow-hidden` appears outside the approved primitive or animation-mask files.

#### Scenario: Unauthorized raw overflow-hidden is introduced
- **WHEN** a source file in `packages/webui` uses raw `overflow-hidden` outside the approved allowlist
- **THEN** the overflow source-contract test fails
- **THEN** the regression is blocked before merge
