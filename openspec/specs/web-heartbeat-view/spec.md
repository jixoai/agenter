# web-heartbeat-view Specification

## Purpose

Define the standalone Heartbeat presentation package atom that can render grouped LoopBus Heartbeat facts without importing Studio route or controller state.

## Requirements

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

### Requirement: Web heartbeat view SHALL encode kind-specific record card grammars

The package SHALL expose distinct visual grammars for each Heartbeat record kind instead of forcing every record through the same middle graphic. List rows SHALL be composed from shared `BasicRecordCard` shells, `x-model-run-card` instances, and kind-specific card-body primitives rather than bespoke row chrome. `model_call` rows SHALL use an adaptive metro-style timeline whose middle combo chip stays centered while width reveals more explicit stations with tail-first priority. `compact` rows SHALL use a compression-channel object, and `config` rows SHALL use a changed-controls strip. These card grammars SHALL remain bounded inside the list row, SHALL use chip- or surface-level `title` attributes for richer descriptions, SHALL omit facts that are already inferable from the header, line timing, or summary line, and SHALL suppress preview text entirely when no durable assistant preview exists. Running rows SHALL apply restrained motion to the time/status surfaces without changing layout geometry, while error rows SHALL remain visually stable and explicitly marked.

#### Scenario: Model-call card adapts without overflow

- **WHEN** the same `model_call` record row is rendered across narrower and wider mobile or desktop widths
- **THEN** the card keeps a bounded row footprint
- **AND** the middle combo chip stays centered
- **AND** tail detail is revealed before earlier stations as width grows

#### Scenario: List rows reuse shared record cards

- **WHEN** the package renders the record list
- **THEN** `model_call` rows use `x-model-run-card`
- **AND** `compact` rows use `x-basic-record-card` with `x-compact-body`
- **AND** `config` rows use `x-basic-record-card` with `x-config-body`

#### Scenario: Compact and config do not reuse the metro grammar

- **WHEN** the package renders `compact` and `config` records
- **THEN** `compact` uses its compression-channel grammar and `config` uses its changed-controls grammar
- **AND** neither record kind is forced through the `model_call` metro timeline

#### Scenario: Running and error states stay objective

- **GIVEN** a Heartbeat record has `running` or `error` status
- **WHEN** the package renders its list row
- **THEN** running status uses bounded animation on time/status surfaces and the record body
- **AND** error status uses a stable error surface or chip without implying continued progress
- **AND** the row height and chip positions do not depend on animation frames

#### Scenario: Missing preview remains omitted

- **WHEN** one record has no durable assistant text preview
- **THEN** the list row omits the preview line entirely
- **AND** the package does not render placeholder prose such as `No summary`

#### Scenario: Redundant chip facts stay omitted

- **WHEN** the header, the line label, or the summary line already carries the operator-visible fact
- **THEN** the list row does not repeat that fact inside a chip
- **AND** the row prefers omission over a duplicate metric badge or duplicate content preview

### Requirement: Web heartbeat view SHALL render kind-specific record detail surfaces

The package SHALL render selected record detail as a separate surface from the paginated list row. Detail SHALL reuse the same `BasicRecordCard`, `RecordChip`, and kind-specific card-body semantics used by list rows, treating the list card as the compressed density and detail as the expanded density. Detail navigation SHALL be built from `RecordChip` chips plus line intervals, so the selected record reads like a chips-line page instead of a bespoke side list. `model_call` detail SHALL expand the row's horizontal metro grammar into a vertical step inspection surface with sticky chips on the left and full per-step content on the right. `compact` detail SHALL keep the same compression object visible before tabs named `New Context` and `Old Context`, defaulting to `New Context`, and SHALL render streaming, empty, and error states inside the tab content. `config` detail SHALL keep the same changed-controls object visible before tabs named `Diff Config`, `New Config`, and `Old Config`, defaulting to a YAML diff view while rendering new and old configs as YAML source views. Opening or refreshing detail SHALL NOT expand neighboring list rows or change current page-window membership.

#### Scenario: Model-run detail expands metro into vertical steps

- **WHEN** the operator selects one `model_call` record
- **THEN** the detail surface shows a vertical step rail derived from the same input/thinking/tool/text/error/pending chip semantics as the list card
- **AND** the left step chips remain sticky while the right content area scrolls through full step details
- **AND** running or pending latest steps use bounded motion without changing layout geometry

#### Scenario: Detail reuses list primitives

- **WHEN** the operator opens detail for `model_call`, `compact`, or `config`
- **THEN** the detail surface reuses the same record chip taxonomy, body object, color semantics, and status language as the list row
- **AND** detail expands those primitives instead of introducing unrelated mini chips, duplicate body widgets, or a second visual grammar

#### Scenario: Detail navigation is chips-line based

- **WHEN** the operator opens selected record detail
- **THEN** the navigation rail is composed from `RecordChip` chips plus line intervals
- **AND** the rail stays sticky on desktop and collapses into a compact horizontal chips line on mobile

#### Scenario: Compact detail focuses the new context

- **WHEN** the operator selects one `compact` record
- **THEN** the detail surface opens with `New Context` selected
- **AND** `Old Context` remains available as a secondary tab
- **AND** streaming, empty, and error states are represented inside `New Context` without replacing already streamed context content

#### Scenario: Config detail is diff first

- **WHEN** the operator selects one `config` record
- **THEN** the detail surface opens with `Diff Config` selected
- **AND** the diff is rendered as YAML-friendly multiline content
- **AND** `New Config` and `Old Config` render complete YAML source views for inspection

### Requirement: Web heartbeat view SHALL consume Heartbeat record resources

The package SHALL render Heartbeat from paged Heartbeat record resources plus optional selected-record detail resources and anchor state instead of reconstructing the surface from grouped Heartbeat pages or raw histories in the browser. Its public input contract SHALL preserve explicit cached-resource state for record count/page, selection detail, and anchor state, including at least `loading`, `loaded`, `refreshing`, `error`, and `data` facts where applicable. Empty display SHALL be derived from loaded-empty list state rather than from an empty array alone.

#### Scenario: Cold load is distinct from loaded empty

- **WHEN** a host mounts the Heartbeat view before the first record page has settled
- **THEN** the package renders a loading state
- **AND** it does not render a no-records empty state until the list resource has explicitly loaded empty

#### Scenario: Warm refresh keeps mounted rows and current detail

- **GIVEN** one record page and one selected detail are already visible
- **WHEN** realtime invalidation marks the list resource or detail resource as refreshing
- **THEN** the package keeps the visible rows and selected detail mounted
- **AND** it shows only secondary refresh feedback until fresher data or an error arrives

#### Scenario: Browser presentation does not rebuild runtime truth

- **WHEN** a host supplies record rows, record detail, anchor state, scheduler state, attention summary, and delivery facts
- **THEN** the package projects those typed inputs into UI sections
- **AND** it does not regroup persisted histories locally to recover list semantics

### Requirement: Web heartbeat view SHALL preserve the structured LoopBus runtime story through record list and detail surfaces

The package SHALL render the Avatar runtime story as a stable paginated record list plus a separate structured detail surface. The list SHALL stay bounded and scan-friendly, while the detail surface SHALL render full request facts, assistant text, reasoning, JSON/config facts, tool invocations/results, compact boundaries, model metadata, scheduler containment, and attention summary for the selected record. Tool activity SHALL remain objectively inspectable while running.

#### Scenario: List rows stay bounded while detail reveals structure

- **WHEN** Heartbeat data contains prompt facts, one model run, tool activity, assistant segments, and compact or config facts
- **THEN** the list renders one bounded record row per operator-visible record
- **AND** selecting one row reveals the full structured detail for that record without expanding the surrounding list rows

#### Scenario: Tool invocation intent is visible before completion

- **WHEN** one selected `model_call` detail contains a running tool invocation with durable parameters but no result
- **THEN** the package labels that tool step as running
- **AND** it renders the available invocation parameters on that same detail surface before completion

#### Scenario: Compact and config detail remain part of the same Heartbeat story

- **WHEN** the operator opens detail for one `compact` or `config` record
- **THEN** the package reveals the exact prompt facts, usage deltas, and changed controls that produced that record
- **AND** those facts remain inside the Heartbeat story rather than opening an unrelated admin form

### Requirement: Web heartbeat view SHALL expose readonly and configable capability modes

The package SHALL model Heartbeat presentation capability through an explicit `HeartbeatCapabilityMode` with values `readonly` and `configable`. In `readonly` mode, the package SHALL render list and detail inspection surfaces without exposing compact/config mutation actions. `readonly` SHALL be a frontend presentation mode for keeping the interface clean, not a backend permission boundary or a promise of zero backend writes. In `configable` mode, the package SHALL expose authorized compact/config actions from the bottom toolbar or its linked modal surfaces. Missing handlers or denied authority SHALL be represented as unavailable capability state instead of falling through to fake transcript commands or hidden side effects.

#### Scenario: Readonly mode keeps record inspection but hides mutation actions

- **GIVEN** the package is rendered with mode `readonly`
- **WHEN** the operator inspects the record list, detail surface, and bottom toolbar area
- **THEN** record inspection remains fully available
- **AND** compact/config write actions are not available as executable controls

#### Scenario: Configable mode exposes compact and next-call config actions

- **GIVEN** the package is rendered with mode `configable`
- **WHEN** the host supplies manual compact and next-call config handlers
- **THEN** the bottom action surfaces expose those actions explicitly
- **AND** invoking them uses host-provided control paths rather than fake transcript commands

### Requirement: Web heartbeat view SHALL provide a host-neutral connection boundary

The package SHALL expose host-neutral types and bindings for a Heartbeat connection boundary named `AgenterHeartbeatConnection`, without making transport creation mandatory for the presentational view. The boundary SHALL be able to carry Avatar identity, deterministic runtime/session identity, exact record count, current page window, latest/fixed anchor state, `newRecordsAvailable` state, selected record identity, selected record detail, scheduler state, attention/delivery summaries, page-navigation callbacks, selection callbacks, and optional configable actions. The package SHALL treat the connection as an adapter contract over existing runtime/client-sdk facts, not as a new backend truth source or a new backend endpoint.

#### Scenario: Presentational view does not create transport implicitly

- **WHEN** a host mounts `HeartbeatView` with already-adapted runtime facts
- **THEN** the view renders without creating an Agenter transport client
- **AND** transport and auth decisions remain host-owned

#### Scenario: Connection adapter can drive list, detail, and anchor state

- **WHEN** a host chooses to use an `AgenterHeartbeatConnection`
- **THEN** the adapter supplies the same typed list/detail resources and callbacks that a direct host integration would supply
- **AND** the renderer remains unaware of whether those facts came from Studio, the standalone example, or another Agenter host

### Requirement: Web heartbeat view SHALL be mobile-first and Framework7-compatible

The package SHALL treat mobile Heartbeat inspection as the canonical layout. On compact viewports, the default interaction SHALL remain scan-first record browsing with a secondary detail route or surface that preserves the same parser and card law. Desktop layouts MAY co-locate list and detail or add width-specific affordances, but they SHALL extend the same mobile-first record/list/detail contract rather than introducing a second renderer or a dashboard-only interpretation.

#### Scenario: Compact viewport keeps list scanning and detail navigation usable

- **WHEN** the Heartbeat view is rendered at an iPhone-class width
- **THEN** the record list remains the primary scroll surface
- **AND** the operator can still reach selected detail, anchor state, and bottom actions without horizontal overflow

#### Scenario: Desktop adapts the same record/detail law

- **WHEN** the Heartbeat view is rendered in a wide host surface
- **THEN** it may show list and detail together or use wider layouts for the same cards
- **AND** it does not invent a second parser, second card grammar, or dashboard-specific data model
