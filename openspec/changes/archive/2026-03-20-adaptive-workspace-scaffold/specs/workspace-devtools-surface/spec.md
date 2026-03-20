## ADDED Requirements

### Requirement: Workspace Devtools SHALL adapt cycle detail presentation by viewport class
The WebUI SHALL present cycle inspection as a desktop-or-landscape split pane and as a portrait compact right-sheet detail flow. Devtools MUST keep the technical tab strip fixed in route-local chrome while the selected panel owns its own scrolling behavior.

#### Scenario: Desktop or landscape Devtools uses split cycle detail
- **WHEN** the user opens Devtools on an expanded viewport or any landscape viewport
- **THEN** the cycle timeline and selected cycle detail are visible side by side
- **THEN** selecting a cycle updates the detail pane without opening a sheet

#### Scenario: Portrait compact Devtools uses right-sheet cycle detail
- **WHEN** the user opens Devtools on a compact or medium portrait viewport and selects a cycle
- **THEN** the cycle detail opens in a right-side sheet
- **THEN** the timeline remains the primary in-page panel behind that sheet

### Requirement: Workspace Devtools SHALL preserve route-local tab and panel ownership
The WebUI SHALL keep Devtools tabs in route-local chrome outside the active panel viewport, and each active Devtools panel SHALL own its own primary scrolling surface without depending on outer route wrappers for scrolling.

#### Scenario: Active Devtools panel owns scrolling
- **WHEN** a Devtools panel contains content taller than the available route viewport
- **THEN** that panel provides its own primary scroll viewport
- **THEN** the route wrapper does not introduce an additional competing scroll layer for the same content
