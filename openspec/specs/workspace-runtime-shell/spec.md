# workspace-runtime-shell Specification

## Purpose
Define the durable Avatar detail shell that sits behind the global `Avatars` workbench and runtime entry actions.
## Requirements
### Requirement: Running-avatar detail SHALL be a secondary runtime surface
The WebUI SHALL expose running-avatar detail through dynamic session tabs inside the global `Avatars` workbench and through explicit runtime-entry actions, rather than through workspace-local embedded avatar pages or a separate secondary `Running Avatars` detail rail. In the active Svelte WebUI this shell SHALL remain addressable through dedicated runtime routes and SHALL preserve reload-safe deep linking.

#### Scenario: Dynamic avatar tab opens the running-avatar shell
- **WHEN** the user activates a running-avatar tab from the `Avatars` workbench
- **THEN** the application opens the running-avatar detail shell for that session
- **AND** the current primary destination remains `Avatars`, `Messages`, `Workspaces`, or `Terminals`

#### Scenario: Global runtime entry opens the same shell
- **WHEN** the user opens a running avatar from a global runtime entry point rather than a workspace-local avatar page
- **THEN** the application opens the same running-avatar detail shell model used by the dynamic avatar tab
- **AND** the detail behavior does not depend on a workspace-local avatar wrapper being present

### Requirement: Avatar detail SHALL compose `main-area`, `bottom-area`, and `right-drawer` inside `page_content`
The runtime shell SHALL present the active tab content through one `page_content` region that contains a large primary `main-area`, a quieter `bottom-area` for auxiliary actions or inbox material, and a `right-drawer` for advanced metadata or inspection. The route shell and stage panels SHALL derive their structure from shared scaffold-family primitives instead of local split-layout classes.

#### Scenario: Runtime shell derives from shared scaffold law without duplicate outer panes
- **WHEN** the user opens a runtime route
- **THEN** the page uses shared scaffold primitives to allocate `main-area`, `bottom-area`, and `right-drawer` inside the shared window body
- **AND** the stage header stays outside the body scroll region without page-local stretch-layout patches

### Requirement: Avatar detail SHALL expose `Heartbeat`, `Attention`, and `Settings` as peer runtime tabs
The Avatar detail shell SHALL expose flat runtime-specific peer tabs named `Heartbeat`, `Attention`, and `Settings`. The default selected tab SHALL be `Heartbeat`.

#### Scenario: Runtime peer tabs stay focused on the simplified shell
- **WHEN** the user opens a running-avatar detail shell
- **THEN** `Heartbeat`, `Attention`, and `Settings` are available as peer tabs in the same shell layer
- **AND** `Cycles` or `OpenTelemetry` are not required as primary peer tabs

#### Scenario: Heartbeat is the default runtime tab
- **WHEN** the user opens a running-avatar detail shell without an explicit tab
- **THEN** the shell lands on `Heartbeat` by default
- **AND** the current runtime heartbeat is visible without an extra tab switch

### Requirement: Runtime shell routes land on the canonical heartbeat tab
The runtime shell SHALL expose a canonical runtime destination for each avatar session and SHALL route runtime entry URLs to `Heartbeat` without requiring feature-level navigation glue. Opening that route SHALL also trigger the data hydration needed for `Heartbeat`, `Attention`, and `Settings`, even when the shell starts from a cold browser state.

#### Scenario: Runtime rail links land on heartbeat by default
- **WHEN** the operator opens a session from the runtime rail or a direct runtime entry URL without a tab segment
- **THEN** the browser lands on `/avatars/runtime/{sessionId}/heartbeat`
- **AND** the runtime shell renders without an intermediate error page

#### Scenario: Direct runtime entry hydrates backend facts on first load
- **WHEN** the operator opens `/avatars/runtime/{sessionId}/heartbeat` directly from a cold browser state
- **THEN** the shell hydrates persisted or live heartbeat history, attention/notification state, and runtime settings sources from backend APIs
- **AND** the first render does not depend on a prior websocket event or on visiting another page first

### Requirement: Heartbeat SHALL render one continuous message-parts runtime stream

The `Heartbeat` tab SHALL render one continuous runtime surface backed by durable `message-parts` truth. It SHALL show request-side auxiliary rows, AI-visible request/response rows, and compact boundaries in chronological order without rebuilding the primary story from mixed chat rows, request-aux cards, and model-call cards.

#### Scenario: Heartbeat opens with folded auxiliary facts and durable AI-visible rows

- **WHEN** the operator opens `Heartbeat` for a session that already recorded `systemPrompt`, `tools`, `config`, request rows, response rows, or compact boundaries
- **THEN** the stage renders those rows from the durable Heartbeat `message-parts` stream in chronological order
- **AND** `systemPrompt`, `tools`, `config`, and `compact` rows are visually subordinate and collapsed by default
- **AND** AI-visible request/response rows remain readable as the primary stream content

#### Scenario: Heartbeat updates live without mixed inspection cards

- **WHEN** the runtime records a streamed assistant update or a new Heartbeat request row while the operator is watching the tab
- **THEN** the stage updates the affected durable Heartbeat row in place
- **AND** the operator does not need a separate model-call card to understand the live Heartbeat state

### Requirement: Avatar detail SHALL keep notification quick actions inside Attention
The Avatar detail shell SHALL keep notification summaries and quick actions inside the `Attention` tab rather than exposing a separate notification page. `bottom-area` SHALL remain the place for attention-adjacent quick actions or inbox material, while `right-drawer` SHALL stay focused on advanced runtime metadata.

#### Scenario: Background notification appears inside Attention
- **WHEN** the runtime receives a push for a non-focused context and the operator opens Avatar detail
- **THEN** the `Attention` surface can show that notification summary and its quick actions inside the same runtime shell
- **AND** the operator is not required to switch into a separate notification-only page

#### Scenario: Attention detail keeps notifications subordinate
- **WHEN** the operator scans Avatar detail navigation
- **THEN** notification actions stay subordinate to `Attention`
- **AND** they do not become their own primary runtime tab

### Requirement: Attention main-area SHALL present one continuous runtime story
The `Attention` tab `main-area` SHALL remain a continuous runtime surface rather than a split dashboard. It SHALL present the selected `AttentionContext` first, then the currently focused context stack, and then the queued push inbox. Notification rows SHALL stay compact until they are promoted into active attention or resolved through `bottom-area` quick actions.

#### Scenario: Operator reads the current attention state from top to bottom
- **WHEN** the operator opens the `Attention` tab
- **THEN** the first visible runtime block identifies the currently selected `AttentionContext`
- **AND** focused contexts appear below it as the active stack
- **AND** queued pushes appear after the focused stack instead of occupying a separate peer pane

#### Scenario: Queued push stays subordinate until promoted
- **WHEN** a background notification enters `Attention`
- **THEN** it appears inside the push inbox as a compact queued row
- **AND** the operator can resolve it with `bottom-area` quick actions
- **AND** it does not replace the current `AttentionContext` until explicitly promoted

#### Scenario: Attention shows persisted or explicit empty state on first load
- **WHEN** the operator opens `Attention` from a direct runtime route
- **THEN** the stage renders current runtime attention facts when available, or a clear empty-state explanation when none exist
- **AND** the operator does not see a blank shell caused only by missing initial client hydration

### Requirement: Attention drawer SHALL use light sectional inspection
The `Attention` tab `right-drawer` SHALL prefer section headings plus simple dividers over stacked metadata cards. Runtime inspection sections such as selection facts, delivery contract, suggested response, and linked runtime sources SHALL remain readable without turning the drawer into another dashboard. Low-priority summary facts SHALL stay docked at the bottom of the drawer.

#### Scenario: Operator inspects a selected attention source
- **WHEN** the operator selects or focuses one attention source
- **THEN** the `right-drawer` shows lightweight inspection sections for that source
- **AND** the drawer preserves a clear top-to-bottom reading order for actionable facts before passive metadata

#### Scenario: Drawer keeps summary facts subordinate
- **WHEN** the drawer displays selection counts or passive runtime facts
- **THEN** those facts appear in a docked summary section near the bottom
- **AND** they do not reappear as a second stack of bordered cards above the main inspection sections

### Requirement: Avatar detail SHALL NOT re-embed workspace or history surfaces as primary runtime panes
The Avatar detail shell SHALL focus on runtime concerns and SHALL NOT restore workspace browsing, history browsing, or other system catalogs as first-class peer panes inside the runtime body. When the operator needs those resources, the shell SHALL link out to the corresponding global system surface.

#### Scenario: Runtime detail stays heartbeat-first
- **WHEN** the operator opens Avatar detail
- **THEN** the dominant `main-area` remains the current heartbeat or attention work surface
- **AND** the shell does not embed a workspace catalog or history page as another primary runtime pane

#### Scenario: Operator leaves runtime detail to inspect another system surface
- **WHEN** the operator wants to inspect a workspace, room, or terminal in depth
- **THEN** the application navigates to the corresponding global system surface
- **AND** Avatar detail remains a runtime workbench rather than a nested all-systems dashboard

### Requirement: Settings SHALL remain runtime-scoped and separate from workspace rules

The `Settings` tab SHALL preserve avatar-runtime configuration as a dedicated runtime-scoped settings graph surface. It SHALL explain effective values, source layers, and provenance jumps for the current runtime scope instead of degrading into a single-file editor.

#### Scenario: Runtime Settings flatten workspace scope with avatar scope

- **WHEN** the operator opens `Settings` for a running avatar session
- **THEN** the stage resolves scoped settings using the runtime workspace plus the current avatar nickname
- **AND** the effective view reflects avatar-specific overrides on top of workspace or global layers

#### Scenario: Runtime Settings jump from effective value to source layer

- **WHEN** the operator selects a provenance source from the effective settings view
- **THEN** the stage jumps to the matching source layer
- **AND** the layer editor focuses the mapped pointer instead of leaving the operator in a disconnected single-file editor

### Requirement: Avatar runtime pages SHALL preserve the same capability path across desktop and compact breakpoints
Responsive avatar runtime layouts SHALL preserve the same runtime tabs and page responsibilities even when the geometry changes. `Tablet landscape` MAY keep a visible left sidebar and persistent drawer longer, while `tablet portrait` and `phone` MAY collapse navigation into a compact shell and stack the detail surface below the `bottom-area`.

#### Scenario: Use avatar runtime on tablet landscape
- **WHEN** the operator opens avatar runtime detail on a landscape tablet viewport
- **THEN** the page can keep the visible sidebar and persistent right drawer if space allows
- **AND** the operator can still switch between `Heartbeat`, `Attention`, and `Settings`

#### Scenario: Use avatar runtime on portrait tablet or phone
- **WHEN** the operator opens avatar runtime detail on a portrait tablet or phone viewport
- **THEN** the left navigation can collapse into a compact shell
- **AND** the drawer can become a stacked sheet below the `bottom-area`
- **AND** the same runtime tabs and page actions remain reachable
