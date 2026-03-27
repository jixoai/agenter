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

#### Scenario: Multi-context attention facts preserve context ownership
- **WHEN** a cycle fact contains an `attention-system-active` payload with multiple attention contexts
- **THEN** Devtools renders a readable attention summary that reflects the multi-context payload instead of falling back to an opaque raw dump
- **THEN** each rendered attention item preserves enough ownership metadata to show which context it came from
- **THEN** structured inspection remains available for exact payload review

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

#### Scenario: Inactive tabs do not keep heavy runtime subscriptions alive
- **WHEN** the user views one Devtools tab while other tabs remain inactive
- **THEN** only the active tab subscribes to its heavy runtime slices and derived view-models
- **THEN** inactive tabs do not retain model/API stream work or hot list projections unnecessarily

### Requirement: Devtools long-history panels SHALL use the shared reverse-time loading model
Cycle, LoopBus, Terminal Activity, and Model history panels SHALL all expose the same older-page loading semantics instead of bespoke list contracts.

#### Scenario: Panels share one older-page contract
- **WHEN** the user loads older data in different Devtools panels
- **THEN** each panel uses the same `hasMoreBefore` / `loadingOlder` semantics
- **THEN** panel-specific rendering can change without redefining paging behavior

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

### Requirement: Devtools SHALL reflect the published LoopBus runtime model
The Devtools surface SHALL inspect LoopBus runtime state and traces through the explicit publication contract introduced by the LoopBus runtime refactor.

#### Scenario: Devtools renders cycle phases from published runtime state
- **WHEN** the session runtime publishes LoopBus phases and trace entries
- **THEN** Devtools renders those phases and traces from the published contract
- **THEN** UI logic does not depend on backend-private LoopBus state assembly

### Requirement: Devtools SHALL embed the standalone terminal renderer instead of owning terminal rendering internals
The Devtools surface SHALL consume the standalone `terminal-view` renderer contract and keep its own responsibility limited to layout, selection, and surrounding inspection controls.

#### Scenario: Devtools hosts a terminal-view instance
- **WHEN** the Devtools surface renders a terminal panel
- **THEN** it embeds the standalone `terminal-view` component for the terminal body
- **THEN** Devtools-specific code does not re-implement xterm rendering internals locally

### Requirement: Devtools SHALL preserve persisted cycle history across lifecycle changes
The cycle inspection surface SHALL continue to render persisted cycle history after a session is paused or aborted, unless the session history itself has been removed.

#### Scenario: Paused session still shows cycles
- **WHEN** a session with persisted cycle history is paused
- **THEN** Devtools continues to show the previously loaded cycle timeline and detail
- **THEN** the empty-state message is not shown just because live runtime state was cleared

### Requirement: Cycle technical records SHALL render as merged tool traces
Tool lifecycle records SHALL be represented by one structured invocation message (`channel: tool`) instead of paired `tool_call` and `tool_result` markdown records.

#### Scenario: Structured invocation drives cycle detail
- **WHEN** a cycle contains tool lifecycle output
- **THEN** cycle detail renders invocation cards from structured invocation metadata
- **THEN** the UI does not need markdown fence pairing or timestamp heuristics to merge call/result

