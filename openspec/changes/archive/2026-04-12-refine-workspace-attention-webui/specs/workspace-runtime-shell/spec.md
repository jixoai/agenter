## MODIFIED Requirements

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

### Requirement: Avatars workbench SHALL keep a fixed catalog tab and addable creation tabs
The global `Avatars` workbench SHALL expose one fixed `Catalog` tab as its durable landing surface. Running-avatar tabs and `New avatar` draft tabs SHALL open as addable browser-style tabs without replacing the fixed catalog.

#### Scenario: Global Avatars landing route keeps Catalog fixed
- **WHEN** the user opens `/avatars` or `/avatars/catalog`
- **THEN** the workbench lands on the fixed `Catalog` tab
- **AND** the catalog remains available after runtime or creation tabs are opened

#### Scenario: Multiple avatar drafts stay open in parallel
- **WHEN** the user opens `New avatar` more than once from the Avatars workbench
- **THEN** each request opens its own closable draft tab
- **AND** closing one draft tab does not close the fixed catalog or the remaining draft tabs

## ADDED Requirements

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

### Requirement: Heartbeat SHALL render one continuous AI-call runtime stream
The `Heartbeat` tab SHALL render the session heartbeat as one continuous runtime message surface backed by the session AI-call ledger. It SHALL present role-user and role-assistant messages as the dominant stream and SHALL treat virtualization as a list concern separate from message rendering primitives.

#### Scenario: Heartbeat shows the runtime message stream
- **WHEN** the operator opens `Heartbeat`
- **THEN** the `main-area` renders the current session heartbeat as one ordered user/assistant stream
- **AND** that stream is hydrated from persisted or live AI-call and message-part facts instead of old cycle cards

#### Scenario: Long heartbeat history remains renderable
- **WHEN** the session contains a long heartbeat history
- **THEN** the page can virtualize the list without changing the message rendering contract
- **AND** the runtime shell does not hard-couple one message UI library to the list controller

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
The `Settings` tab SHALL preserve avatar-runtime configuration as a dedicated surface. Its `main-area` SHALL present runtime-scoped settings, its `bottom-area` SHALL expose save/reset/restart-style actions, and its detail sheet or drawer SHALL surface passive runtime metadata without taking over the page.

#### Scenario: Edit avatar runtime settings
- **WHEN** the operator opens `Settings`
- **THEN** the main surface shows avatar-runtime settings such as attention defaults, notification policy, quick replies, or linked-system preferences
- **AND** the page does not masquerade as a workspace-rule editor

#### Scenario: Save or revert runtime configuration
- **WHEN** the operator changes settings inside the runtime shell
- **THEN** save/reset/restart-style actions remain in the `bottom-area`
- **AND** passive metadata such as runtime status or export flags remains secondary in the detail sheet or drawer

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

## REMOVED Requirements

### Requirement: Cycles SHALL present runtime rounds as a dedicated chronology surface
**Reason**: cycle chronology is no longer a primary Avatar detail tab after the runtime shell was simplified around `Heartbeat`.
**Migration**: expose future cycle drilling through secondary tooling surfaces or a dedicated follow-up route instead of a primary runtime tab.

### Requirement: OpenTelemetry SHALL replace generic trace placeholders with direct telemetry inspection
**Reason**: telemetry is no longer part of the primary Avatar detail shell and is being moved toward separately controlled tooling.
**Migration**: use future dedicated telemetry tooling once the external capture surface is introduced.
