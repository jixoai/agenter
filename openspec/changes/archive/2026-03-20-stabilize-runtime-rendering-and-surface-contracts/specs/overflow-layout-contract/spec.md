## MODIFIED Requirements

### Requirement: WebUI overflow roles SHALL use explicit surface contracts
The WebUI SHALL distinguish layout containment, scrolling, visual clipping, semantic background ownership, and animation masking as separate surface roles. Layout wrappers MUST NOT use raw `overflow-hidden` or own raw background color unless they are implemented through an approved surface primitive.

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
