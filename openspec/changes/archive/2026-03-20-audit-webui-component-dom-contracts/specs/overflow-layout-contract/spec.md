## MODIFIED Requirements

### Requirement: WebUI panels SHALL expose one primary scroll viewport
Each major WebUI application surface SHALL provide exactly one deliberate primary scroll container for its main content region, while headers, tabs, and fixed controls remain outside that viewport. This contract also applies when transcript and Devtools internals are decomposed into smaller reusable components.

#### Scenario: Transcript and Devtools decomposition preserves scroll ownership
- **WHEN** a transcript or Devtools panel is split into smaller reusable subcomponents
- **THEN** the surrounding surface still exposes one explicit primary scroll owner for the long content region
- **THEN** the new child components do not introduce competing hidden or auto overflow wrappers
