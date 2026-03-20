## MODIFIED Requirements

### Requirement: WebUI overflow roles SHALL use explicit surface contracts
The WebUI SHALL distinguish layout containment, scrolling, visual clipping, semantic background ownership, and animation masking as separate surface roles. Layout wrappers MUST NOT use raw `overflow-hidden` or own raw background color unless they are implemented through an approved surface primitive, and page-local headers MUST NOT absorb global-navigation responsibilities.

#### Scenario: Layout wrapper uses the explicit contract
- **WHEN** a WebUI shell or panel wrapper needs to size descendants without clipping them
- **THEN** it does not use raw `overflow-hidden`
- **THEN** scrolling and clipping are delegated to explicit child surfaces

#### Scenario: Visual clipping remains deliberate
- **WHEN** a surface needs rounded-corner or viewport clipping for media, terminal chrome, or similar presentational content
- **THEN** it uses an approved clipping primitive instead of a raw layout wrapper class

#### Scenario: Background ownership stays semantic
- **WHEN** a wrapper only exists to satisfy flex, grid, or shell layout structure
- **THEN** it does not introduce a raw background color
- **THEN** background color is owned only by a semantic surface or a clipping surface that needs visual fill for media-like content

### Requirement: WebUI panels SHALL expose one primary scroll viewport
Each major WebUI application surface SHALL provide exactly one deliberate primary scroll container for its main content region, while headers, tabs, and fixed controls remain outside that viewport, including Chat, Devtools, and navigation shells rendered on compact mobile layouts.

#### Scenario: Panel with long content remains operable
- **WHEN** a panel contains content taller than the available viewport
- **THEN** the panel exposes a single primary scroll viewport for that content
- **THEN** the panel header and fixed controls remain visible outside the scrolling region

#### Scenario: Nested wrappers do not compete for scrolling
- **WHEN** the panel is composed from shell, async, and content wrappers
- **THEN** only the designated primary scroll viewport owns scrolling for the main content area
- **THEN** ancestor layout wrappers do not introduce competing hidden or auto overflow behavior

#### Scenario: Minimum mobile viewport still remains usable
- **WHEN** the application is rendered in a compact viewport such as 375x667
- **THEN** Chat, Devtools, and navigation surfaces remain scrollable with visible primary controls
- **THEN** fixed chrome does not trap or hide the main content region

### Requirement: Raw overflow-hidden usage SHALL be statically enforceable
The WebUI source tree SHALL fail contract verification if raw `overflow-hidden` appears outside the approved primitive or animation-mask files, and it SHALL also fail if raw `bg-*` classes are introduced on non-semantic layout wrappers outside the approved allowlist.

#### Scenario: Unauthorized raw overflow-hidden is introduced
- **WHEN** a source file in `packages/webui` uses raw `overflow-hidden` outside the approved allowlist
- **THEN** the overflow source-contract test fails
- **THEN** the regression is blocked before merge

#### Scenario: Unauthorized raw background ownership is introduced
- **WHEN** a source file in `packages/webui` adds raw `bg-*` ownership to a non-semantic layout wrapper outside the approved allowlist
- **THEN** the surface-contract test fails
- **THEN** the regression is blocked before merge
