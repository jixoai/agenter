## ADDED Requirements

### Requirement: Web heartbeat view SHALL own Heartbeat presentation as a package atom

The system SHALL introduce `@agenter/web-heartbeat-view` as the package-owned Heartbeat presentation atom. The package SHALL own Heartbeat grouping-derived presentation, parser/materialization helpers, row rendering, footer statusbar presentation, and the minimal AI-elements-style primitives required by the Heartbeat surface. The package SHALL NOT import from `apps/studio` or depend on Studio route/controller context. Consumer hosts MAY import the package and adapt their own runtime/store state into the package contract.

#### Scenario: Package renders without Studio imports

- **GIVEN** a host application imports `@agenter/web-heartbeat-view`
- **WHEN** the package renders a Heartbeat stream
- **THEN** the rendered surface is produced from package-owned code and public package dependencies
- **AND** no module under `apps/studio` is required for parser, renderer, statusbar, or AI-elements-style presentation

#### Scenario: Standalone host uses a future-Studio-compatible law

- **GIVEN** the standalone example renders Heartbeat for an Avatar target
- **WHEN** the package renders that surface
- **THEN** the renderer owns the same parser and presentation law that Studio can later consume
- **AND** first-phase implementation does not require Studio to migrate before example acceptance
- **AND** host-specific route chrome remains outside the package presentation law

### Requirement: Web heartbeat view SHALL lift the Studio Heartbeat baseline and fix stability bugs

The first implementation SHALL treat the existing `apps/studio` Heartbeat surface as the behavioral and visual baseline. It MAY directly copy and reorganize Studio Heartbeat parser/rendering code into `@agenter/web-heartbeat-view` before package-specific cleanup. The durable improvement target SHALL be scroll stability, render stability, and performance: the package SHALL remove known jitter, unstable remounting, and avoidable expensive rerenders while preserving Studio's structured Heartbeat behavior.

#### Scenario: Studio baseline is preserved before refinement

- **WHEN** the package implementation starts from Studio Heartbeat code
- **THEN** grouped rows, folding behavior, tool blocks, reasoning/text/json rendering, compact cards, load older, and footer status remain behaviorally recognizable
- **AND** refactoring into the package does not flatten the surface into raw JSON or a simplified log list

#### Scenario: Scroll and rendering instability are treated as product bugs

- **WHEN** Heartbeat rows stream, expand, collapse, paginate older history, or refresh live data
- **THEN** the package keeps row identity and scroll position stable
- **AND** visible rows do not jitter, remount unnecessarily, or degrade into unstable rendering under ordinary Heartbeat updates

### Requirement: Web heartbeat view SHALL consume grouped Heartbeat resource state

The package SHALL render Heartbeat from grouped Heartbeat inspection pages and typed runtime-store projections instead of reconstructing the surface from raw chat, `request_aux`, `heartbeat_part`, or model-call histories in the browser. Its public input contract SHALL preserve explicit cached-resource state for grouped Heartbeat data, including at least `loading`, `loaded`, `refreshing`, `error`, and `data` facts. Empty display SHALL be derived from loaded-empty resource state rather than from an empty array alone.

#### Scenario: Cold load is distinct from loaded empty

- **WHEN** a host mounts the Heartbeat view before grouped Heartbeat data has settled
- **THEN** the package renders a loading state
- **AND** it does not render a no-rows empty state until the grouped resource has explicitly loaded empty

#### Scenario: Warm refresh keeps mounted rows

- **GIVEN** grouped Heartbeat rows are already visible
- **WHEN** realtime invalidation or manual pagination marks the grouped resource as refreshing
- **THEN** the package keeps the visible rows mounted
- **AND** it shows only a secondary refresh signal until fresher data or an error arrives

#### Scenario: Browser presentation does not rebuild runtime truth

- **WHEN** a host supplies grouped Heartbeat items, model-call context, scheduler state, attention summary, and delivery facts
- **THEN** the package projects those typed inputs into UI sections
- **AND** it does not query or merge raw persisted histories to recover the grouped Heartbeat semantics locally

### Requirement: Web heartbeat view SHALL preserve the structured LoopBus runtime story

The package SHALL render the Avatar runtime story as one continuous virtualizable Heartbeat stream that preserves grouped `before-call`, `call`, `compact`, and `before-call-pending` semantics. It SHALL preserve structured rendering for request facts, assistant text, assistant thinking/reasoning, JSON/config facts, tool invocations/results, compact boundaries, model-call context, scheduler containment, and attention summary. Tool activity SHALL remain objectively inspectable while running, including durable invocation parameters when available.

#### Scenario: Grouped facts remain chronological and structured

- **WHEN** grouped Heartbeat data contains prompt facts, a model call, tool activity, assistant segments, and compact boundaries
- **THEN** the package renders those facts in chronological grouped order
- **AND** subordinate request facts such as system prompt, tools, config, and compact prompt facts are collapsible without disappearing from the inspection surface

#### Scenario: Tool invocation intent is visible before completion

- **WHEN** a grouped Heartbeat row contains a running tool invocation with durable parameters but no result
- **THEN** the package labels the tool row as running
- **AND** it renders the available invocation parameters on that same row before completion

#### Scenario: Compact cycles remain one semantic event

- **WHEN** compact prompt facts and the compact result belong to the same compact cycle
- **THEN** the package renders one compact card that can reveal exact prompt facts in detailed mode
- **AND** the compact result stays visible in the same chronological event

#### Scenario: Older history is loaded from the stream edge

- **WHEN** older grouped Heartbeat history is available
- **THEN** the package exposes a top-of-stream load-older affordance
- **AND** while the request is in flight, the same affordance shows loading without unmounting the already visible rows

### Requirement: Web heartbeat view SHALL reuse a shared RecordCard and chips-line detail grammar

The package SHALL present grouped Heartbeat records through a shared `RecordCard` atom in list surfaces. The corresponding detail surface SHALL read as a long list whose primary navigation is a chips-line rail. The package SHALL treat the former standalone Component Continuity surface as folded into `List + Detail` rather than as a separate user-facing mode.

#### Scenario: List rows reuse the same shared card atom

- **WHEN** grouped Heartbeat records are shown in list form
- **THEN** each record is rendered through the shared `RecordCard` atom
- **AND** the list does not introduce a parallel record card implementation for the same content

#### Scenario: Detail navigation uses chips-line as the primary rail

- **WHEN** the operator opens the record detail surface
- **THEN** the page uses chips as the primary navigation atom
- **AND** the visible flow remains a long list rather than a bespoke left-side continuity panel

### Requirement: Web heartbeat view SHALL expose readonly and configable capability modes

The package SHALL model Heartbeat presentation capability through an explicit `HeartbeatCapabilityMode` with values `readonly` and `configable`. In `readonly` mode, the package SHALL render inspection surfaces without exposing compact/config mutation actions. `readonly` SHALL be a frontend presentation mode for keeping the interface clean, not a backend permission boundary or a promise of zero backend writes. Real isolation SHALL be enforced by transport authentication/authorization. In `configable` mode, the package SHALL expose authorized compact/config actions from the bottom statusbar action area. Missing action handlers or denied authority SHALL be represented as unavailable capability state instead of falling through to fake transcript commands or hidden side effects.

#### Scenario: Readonly mode cannot mutate runtime state

- **GIVEN** the package is rendered with mode `readonly`
- **WHEN** the operator inspects the bottom statusbar
- **THEN** compact/config write actions are not available as executable controls
- **AND** the transcript remains a read-only projection of runtime facts
- **AND** the connection adapter may still create or reuse stopped session metadata with `autoStart:false` when required to read persisted Heartbeat facts through existing APIs

#### Scenario: Configable mode exposes bottom statusbar actions

- **GIVEN** the package is rendered with mode `configable`
- **WHEN** the host supplies manual compact and next-call config handlers
- **THEN** the bottom statusbar exposes those actions as explicit controls
- **AND** invoking compact requests a runtime compact action through the host-provided control path rather than inserting a fake `/compact` transcript row

#### Scenario: Partial authority degrades per action

- **GIVEN** the package is rendered with mode `configable`
- **AND** one write action is unavailable because the host lacks authority or a handler
- **WHEN** the bottom statusbar renders
- **THEN** only that action is hidden or disabled with objective unavailable state
- **AND** other authorized actions remain usable

### Requirement: Web heartbeat view SHALL provide a host-neutral connection boundary

The package SHALL expose host-neutral types and bindings for a Heartbeat connection boundary named `AgenterHeartbeatConnection`, without making transport creation mandatory for the presentational view. The boundary SHALL be able to carry Avatar identity, deterministic runtime/session identity, grouped Heartbeat resource state, model-call context, scheduler state, attention/delivery summaries, load-older, realtime refresh lifecycle, live-push status, and optional configable actions. The package SHALL treat the connection as an adapter contract over existing runtime/client-sdk facts, not as a new backend truth source or a new backend endpoint.

#### Scenario: Presentational view does not create transport implicitly

- **WHEN** a host mounts `HeartbeatView` with already-adapted runtime facts
- **THEN** the view renders without creating an Agenter transport client
- **AND** transport/auth decisions remain host-owned

#### Scenario: Connection adapter can drive the same view

- **WHEN** a host chooses to use an `AgenterHeartbeatConnection`
- **THEN** the adapter supplies the same typed view state and callbacks that a direct host integration would supply
- **AND** the Heartbeat renderer remains unaware of whether those facts came from Studio, the standalone example, or another Agenter host

### Requirement: Web heartbeat view SHALL be mobile-first and Framework7-compatible

The package SHALL treat mobile Heartbeat inspection as the canonical layout. Framework7 page/statusbar affordances MAY be exported for hosts that use a Framework7 runtime, but the package SHALL keep the core `HeartbeatView` embeddable as a host-neutral Svelte surface. Desktop layouts SHALL extend the mobile interaction law with wider space rather than introducing a separate dashboard or card-heavy renderer.

#### Scenario: Compact viewport keeps stream and statusbar usable

- **WHEN** the Heartbeat view is rendered at an iPhone-class width
- **THEN** the transcript stream remains the primary scroll surface
- **AND** the bottom statusbar remains reachable above the safe-area while preserving readable runtime status and configable actions when enabled

#### Scenario: Desktop adapts the same law

- **WHEN** the Heartbeat view is rendered in a wide host surface
- **THEN** it may use wider columns, drawers, or detail affordances
- **AND** those affordances do not replace the mobile route/page/statusbar contract or create a second parser/rendering model
