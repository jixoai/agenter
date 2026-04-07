## MODIFIED Requirements

### Requirement: The platform SHALL expose system-first navigation

Compact workbench windows SHALL keep shared tab overflow local to the tab strip chrome. Horizontal tab scrolling on compact devices SHALL NOT widen `document.body` or create a second page-level horizontal scroll.

#### Scenario: Compact tab overflow stays inside workbench chrome
- **WHEN** the operator opens a workbench with multiple tabs on an iPhone 14-sized viewport
- **THEN** the tab strip may scroll horizontally inside its own chrome band
- **AND** `document.body` width stays constrained to the viewport instead of expanding to the tab content width
