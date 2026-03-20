## MODIFIED Requirements

### Requirement: WebUI panels SHALL expose one primary scroll viewport
Each major WebUI application surface SHALL provide exactly one deliberate primary scroll container for its main content region, while headers, tabs, and fixed controls remain outside that viewport. Async wrappers, shell masks, and layout scaffolds MUST preserve that primary scroll owner during live runtime updates instead of reintroducing competing layout overflow behavior.

#### Scenario: Panel with long content remains operable
- **WHEN** a panel contains content taller than the available viewport
- **THEN** the panel exposes a single primary scroll viewport for that content
- **THEN** the panel header and fixed controls remain visible outside the scrolling region

#### Scenario: Nested wrappers do not compete for scrolling
- **WHEN** the panel is composed from shell, async, and content wrappers
- **THEN** only the designated primary scroll viewport owns scrolling for the main content area
- **THEN** ancestor layout wrappers do not introduce competing hidden or auto overflow behavior

#### Scenario: Live runtime updates preserve the same primary scroll owner
- **WHEN** the active surface receives runtime-driven data updates while remaining mounted
- **THEN** async wrappers and layout masks keep the same primary scroll viewport in control of scrolling
- **THEN** the update does not force the surface back to a non-scrollable or duplicated-scroll state
