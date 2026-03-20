## Purpose

Define the dedicated technical inspection surface for workspace Devtools.
## Requirements
### Requirement: Workspace Devtools SHALL own technical session inspection
The WebUI SHALL provide a dedicated Devtools route for technical session inspection, and that route SHALL own cycle-oriented, terminal-oriented, task-oriented, LoopBus-oriented, and model-oriented inspection details that are not part of the default Chat narrative. The cycle-oriented inspection surface SHALL be presented as a live timeline instead of a default accordion dump, and Devtools typography, color density, and tooltips SHALL remain optimized for compact technical reading.

#### Scenario: Devtools opens as the technical inspection surface
- **WHEN** the user opens the Devtools route for a workspace session
- **THEN** the route exposes technical inspection panels for the active session instead of conversation-first chat content
- **THEN** technical details removed from the default Chat route remain available in Devtools

#### Scenario: Cycle inspection shows a live timeline
- **WHEN** the active session contains persisted or active cycles
- **THEN** Devtools exposes the cycle-oriented view as a live timeline with cycle identity, status, and related inspection access
- **THEN** those details remain available even though they are no longer the default structure of Chat

### Requirement: Devtools SHALL expose a cycle-oriented inspection view
The WebUI SHALL expose a Devtools view that allows the user to inspect session cycles and related factual inputs or internal assistant records without requiring those facts to appear in the default Chat flow.

#### Scenario: Cycle inspection shows collected facts and internal records
- **WHEN** the active session contains persisted or active cycles
- **THEN** Devtools exposes a cycle-oriented view that shows cycle identity and related factual inspection content such as collected inputs or internal assistant records
- **THEN** those details remain available even though they are no longer the default structure of Chat

### Requirement: Devtools SHALL keep technical panels independently operable
The WebUI SHALL keep Devtools as the dedicated technical inspection surface, and its cycle, LoopBus, and model-facing panels SHALL remain independently operable within that route instead of relying on one oversized mixed-responsibility panel.

#### Scenario: LoopBus tabs remain independently operable
- **WHEN** the user opens the LoopBus surface inside Devtools
- **THEN** the flow, trace, and model tabs remain independently operable
- **THEN** changing one tab's rendering details does not require restructuring the rest of the Devtools route

#### Scenario: Technical panels preserve compact scroll behavior
- **WHEN** the user browses long technical records in Devtools
- **THEN** each technical panel keeps an explicit primary scroll viewport for its own long content
- **THEN** headers and tab chrome remain outside the scrolled content region

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

