## Purpose

Define the explicit overflow and clipping ownership contract for WebUI layout, scroll, and visual surfaces.
## Requirements
### Requirement: WebUI overflow roles SHALL use explicit surface contracts
The WebUI SHALL distinguish layout containment, scrolling, visual clipping, semantic background ownership, and animation masking as separate surface roles. Layout wrappers MUST NOT use raw `overflow-hidden` or own raw background color unless they are implemented through an approved surface primitive, and semantic surfaces that own rounded clipping MUST also own the fill required to avoid transparent bleed.

#### Scenario: Layout wrapper uses the explicit contract
- **WHEN** a WebUI shell or panel wrapper needs to size descendants without clipping them
- **THEN** it does not use raw `overflow-hidden`
- **THEN** scrolling and clipping are delegated to explicit child surfaces

#### Scenario: Background ownership stays semantic
- **WHEN** a wrapper only exists to satisfy flex, grid, or shell layout structure
- **THEN** it does not introduce a raw background color
- **THEN** background color is owned only by a semantic surface or a clipping surface that needs visual fill for media-like content

#### Scenario: Clip owners also own fill when transparency would bleed
- **WHEN** a rounded clipping surface would otherwise reveal unwanted transparent content beneath it
- **THEN** that same clipping surface owns the required background fill
- **THEN** unrelated layout ancestors do not add compensating background color

### Requirement: WebUI panels SHALL expose one primary scroll viewport
Each major WebUI application surface SHALL provide exactly one deliberate primary scroll container for its main content region, while headers, tabs, fixed controls, and semantic chrome remain outside that viewport. When raw clipping is removed from layout wrappers, the replacement layout MUST explicitly restore required `overflow-auto` behavior on the real scroll owner.

#### Scenario: Panel with long content remains operable
- **WHEN** a panel contains content taller than the available viewport
- **THEN** the panel exposes a single primary scroll viewport for that content
- **THEN** the panel header and fixed controls remain visible outside the scrolling region

#### Scenario: Nested wrappers do not compete for scrolling
- **WHEN** the panel is composed from shell, async, and content wrappers
- **THEN** only the designated primary scroll viewport owns scrolling for the main content area
- **THEN** ancestor layout wrappers do not introduce competing hidden or auto overflow behavior

#### Scenario: Removing clipping restores explicit scrolling
- **WHEN** a layout wrapper stops using raw clipping in order to follow the overflow contract
- **THEN** the surface reassigns scrolling to an explicit `overflow-auto` viewport where needed
- **THEN** long Chat, Devtools, Cycles, and Settings content remains scrollable on desktop and compact viewports

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

### Requirement: Workspace shell routes SHALL declare scroll ownership per route type
The WebUI SHALL declare scroll ownership per workspace route type instead of forcing Chat, Devtools, and Settings through one generic page-scrolling model. Shell scaffolds MAY size route regions, but they MUST NOT become the primary scroll owner for route content.

#### Scenario: Chat keeps transcript-specific scrolling
- **WHEN** the user opens a long Chat session
- **THEN** the transcript viewport owns message scrolling
- **THEN** outer shell wrappers only size the route stage

#### Scenario: Devtools and Settings keep panel-specific scrolling
- **WHEN** the user opens Devtools or Settings content taller than the route viewport
- **THEN** the active technical panel or settings pane owns scrolling for its own content
- **THEN** shared shell wrappers do not suppress that scrolling by adding competing overflow rules or padding stacks

