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

### Requirement: Heartbeat SHALL default to a paged record list with separate detail

The `Heartbeat` tab SHALL default to a stable paginated record list backed by Heartbeat record truth, plus a separate structured detail surface for the currently selected record. The list SHALL show bounded rows with time, kind, status, model-call identity where available, adaptive summary graphics, and optional preview text. Full request facts, assistant segments, tool payloads, JSON bodies, compact deltas, and config changes SHALL live in the detail surface instead of expanding the list row into an unbounded transcript card.

#### Scenario: Heartbeat opens to the latest record page instead of one giant transcript

- **WHEN** the operator opens `Heartbeat` for a session that already recorded model runs, compacts, or config changes
- **THEN** the stage loads the latest record page as the primary list surface
- **AND** the operator can open one record's full structured detail without needing the whole session transcript to mount at once

#### Scenario: Live updates do not reflow historical record rows into transcript cards

- **WHEN** the runtime records new or updated Heartbeat facts while the operator is watching the list
- **THEN** only the affected record rows or the latest page membership change
- **AND** the operator does not need a single continuous transcript stream to understand the live Heartbeat state

#### Scenario: Heartbeat still reuses the outer runtime surface without another framed shell

- **WHEN** the operator opens the `Heartbeat` tab
- **THEN** the runtime body content sits flush inside the shared workbench body without route-local outer padding
- **AND** the Heartbeat stage does not add its own outer rounded border around the list/detail surfaces

### Requirement: Heartbeat SHALL anchor paged record windows and keep list/detail scroll ownership separate

The runtime Heartbeat surface SHALL treat page-window anchoring as a first-class interaction law. It SHALL support at least latest-follow and fixed historical page windows, and it SHALL keep the record list scroll surface independent from the selected-detail scroll surface. Returning from detail SHALL preserve the operator's current page window and list position.

#### Scenario: Fixed record page stays pinned while detail opens and closes

- **WHEN** the operator pins one historical record page and then opens or closes one selected record detail
- **THEN** the list keeps the same page membership and scroll position
- **AND** the detail surface gets its own scroll lifecycle

#### Scenario: Latest jump does not depend on transcript-local imperative scrolling

- **WHEN** the operator chooses to jump back to the latest page window
- **THEN** the Heartbeat stage switches the list anchor back to `latest`
- **AND** the operator does not need to rely on a long transcript scrollback just to reach current state

### Requirement: Heartbeat footer SHALL present objective runtime status and context details

The Heartbeat footer or its equivalent bottom chrome SHALL derive its primary status label from runtime scheduler containment facts rather than from frontend inference over the latest model-call row. The same chrome SHALL render context usage through the shared AI-elements `Context` composition, using the newest available model-call usage plus canonical provider metadata when that metadata exists. When provider metadata is incomplete, the footer SHALL keep the objective usage facts visible and SHALL disable, hide, or degrade the unavailable context details instead of inventing values. Anchor-mode or page-window status MAY appear in adjacent chrome, but it SHALL not become fake record rows.

#### Scenario: Scheduler truth drives the footer status label

- **WHEN** the runtime scheduler reports `running`, `waiting`, `backoff`, `blocked`, `paused`, or `idle`
- **THEN** the Heartbeat footer shows that objective containment state using scheduler facts such as `runtimeStatus` and `waitingReason`
- **AND** the UI does not label the state as `Waiting for AI call` solely because the latest model call is absent or not running

#### Scenario: Footer context uses the shared AI-elements surface

- **WHEN** the newest model call includes usage facts and the active provider exposes context metadata
- **THEN** the Heartbeat footer renders those facts through the shared AI-elements `Context` trigger/content structure
- **AND** the footer does not replace that contract with a bespoke local badge block

#### Scenario: Footer context falls back cleanly when provider metadata is incomplete

- **WHEN** the newest model call includes token usage but the active provider lacks `maxContextTokens` or pricing metadata
- **THEN** the Heartbeat footer still shows the available usage facts
- **AND** max-context progress or estimated cost stays disabled, hidden, or explicitly unavailable instead of inventing values

### Requirement: Heartbeat SHALL distinguish first-load, empty, refreshing, and error states

The `Heartbeat` tab SHALL project its list page, anchor state, and selected detail through explicit resource states rather than treating `no rows mounted` as the only empty condition.

#### Scenario: First load is not mistaken for an empty record list

- **WHEN** the operator opens `Heartbeat` before the first record page has loaded
- **THEN** the stage shows a loading state
- **AND** it does not show the `No Heartbeat records yet` empty-state copy until the list resource has actually loaded empty

#### Scenario: Warm refresh preserves visible list rows and current detail

- **WHEN** the record page resource is already loaded and a refresh is triggered by realtime invalidation or page navigation
- **THEN** the existing Heartbeat rows remain visible
- **AND** the selected detail remains mounted unless that selection itself changes
- **AND** the stage only adds a secondary refresh signal instead of clearing back to blank or empty state

### Requirement: Heartbeat bottom toolbar SHALL expose compact and config actions

The Heartbeat bottom toolbar SHALL expose a dedicated compact action and a dedicated next-call config action through explicit runtime control or settings paths rather than by inserting chat commands into the record list.

#### Scenario: Operator triggers compact from the bottom toolbar

- **WHEN** the operator clicks the compact action in the Heartbeat bottom toolbar
- **THEN** the runtime queues a manual compact request for that session
- **AND** the record list does not gain a fake `/compact` user message just to trigger the cycle

#### Scenario: Operator edits next-call config without mutating the active call

- **WHEN** the operator saves new next-call config from the Heartbeat bottom toolbar flow
- **THEN** the next-call settings change is recorded as Heartbeat fact for the upcoming invocation
- **AND** the currently streaming call, if any, keeps its original config snapshot

### Requirement: Heartbeat record list SHALL keep bounded rows while detail owns expansion

Heartbeat list virtualization or pagination SHALL preserve bounded record rows while delegating large structured expansion to the selected detail surface.

#### Scenario: Opening detail does not leave stale whitespace in the list

- **WHEN** the operator opens or closes detail for one record in the paged list
- **THEN** the list surface does not need disclosure-driven row-height remeasurement for every historical row
- **AND** the list does not retain stale whitespace from transcript-style expansion

### Requirement: Heartbeat compact records SHALL render as compression cards

The Heartbeat surface SHALL render a compact record as one compression-oriented card that keeps before/after context usage, reclaim duration, and compact-specific prompt facts inside the same semantic event.

#### Scenario: Compact card shows before and after context usage

- **WHEN** one compact record is visible in the Heartbeat list
- **THEN** the row renders compact as a compression card rather than as a generic transcript block
- **AND** the operator can scan before/after usage and reclaim duration from the row summary

#### Scenario: Compact detail reveals exact compact prompt facts in the same event

- **WHEN** the operator opens detail for that compact record
- **THEN** the same record reveals the compact system prompt, tool inventory, and other compact prompt facts
- **AND** the compact result stays inside that same chronological event

### Requirement: Heartbeat page-window controls SHALL keep latest and fixed anchors explicit

The Heartbeat list surface SHALL expose page-window navigation and anchor state explicitly. It SHALL make the distinction between `latest`, `fixed`, and `new records available` visible instead of hiding that state inside top-of-transcript load affordances.

#### Scenario: Fixed historical page advertises newer available records objectively

- **WHEN** the operator is pinned to a fixed historical page and newer records later arrive
- **THEN** the Heartbeat stage shows that newer records are available
- **AND** it does not silently jump away from the fixed page

#### Scenario: Latest anchor remains one explicit control path

- **WHEN** the operator returns from historical inspection to the newest Heartbeat state
- **THEN** the Heartbeat stage uses one explicit latest-anchor control path
- **AND** the operator does not need to scroll through the entire list to recover the current state

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

### Requirement: Runtime shell SHALL use shared workbench page-toolbar chrome

The runtime detail route SHALL derive its chrome from the shared `WorkbenchWindow + WorkbenchPageToolbar` contract instead of a runtime-local body header. Runtime title, runtime status, start/stop control, and runtime-tab-local chrome SHALL remain outside the scrollable page body.

#### Scenario: Runtime title and controls live in the page toolbar

- **WHEN** the operator opens a runtime route
- **THEN** the page toolbar shows the runtime title, avatar/workspace metadata, current runtime status, and the start/stop action
- **AND** the page body does not render a second stage header that repeats the same facts

#### Scenario: Stopped Heartbeat first paint can start the runtime

- **GIVEN** an existing avatar runtime route is open on `Heartbeat`
- **AND** that runtime is currently `stopped`
- **WHEN** the operator activates `Start runtime` from the shared page toolbar
- **THEN** the route eventually reflects authoritative `running` status
- **AND** the same route remains open instead of requiring the operator to return to the Avatar Catalog

#### Scenario: Runtime toggle failure is rendered in the route body

- **GIVEN** the operator activates `Start runtime` or `Stop runtime` from the shared page toolbar
- **WHEN** that action fails
- **THEN** the runtime route renders an explicit failure notice in the page body
- **AND** the failure is not left only in console noise or an ignored promise rejection
- **AND** a later successful toggle clears that route-local failure notice

#### Scenario: Runtime tabs keep body height for content

- **WHEN** the operator switches between `Heartbeat`, `Attention`, and `Settings`
- **THEN** each tab reuses the same toolbar chrome host for its title-level metadata and actions
- **AND** the main page body remains reserved for tab content rather than duplicated top chrome

#### Scenario: Runtime detail routes collapse avatar catalog meta chrome

- **WHEN** the operator opens a runtime or avatar-draft detail route inside the avatars workbench
- **THEN** the avatar catalog meta toolbar does not consume a second toolbar row above the runtime page
- **AND** the runtime page-toolbar remains the single durable toolbar row between the avatar tab strip and the detail body

#### Scenario: Shared page-toolbar never expands into multiple rows

- **WHEN** a workbench layout-level toolbar and a route-local `WorkbenchPageToolbar` both exist
- **THEN** the shared page-toolbar keeps its fixed single-row height
- **AND** the route-local portal content overrides the layout toolbar instead of stacking a second row

### Requirement: Heartbeat running group headers SHALL maintain live elapsed durations

Grouped Heartbeat headers SHALL show their start timestamp immediately and SHALL keep the running elapsed duration ticking from wall-clock time while the underlying group is still open.

#### Scenario: Running group duration advances without fresh Heartbeat rows

- **WHEN** a Heartbeat group is still running and no new Heartbeat row arrives for several seconds
- **THEN** the header duration continues to update from wall-clock time
- **AND** the operator does not need a new row or rerender-triggering event to see the elapsed time advance

#### Scenario: Completed group freezes its final duration

- **WHEN** a Heartbeat group stops running because its durable rows are complete
- **THEN** the header shows the final elapsed duration derived from the durable start and end timestamps
- **AND** the clock stops ticking further

### Requirement: Heartbeat top-of-stream pagination SHALL occupy a dedicated flow lane

The grouped Heartbeat transcript SHALL reserve a dedicated top-of-stream lane for older-page pagination so the affordance never overlaps the first group card.

#### Scenario: Pagination affordance sits above the first group row

- **WHEN** older Heartbeat groups are available and the operator reaches the top of the stream
- **THEN** the `Load older` affordance renders in its own lane above the first visible group row
- **AND** it does not visually overlap or occlude the first group card

#### Scenario: Loading older groups shows a disabled loader treatment

- **WHEN** the operator requests older Heartbeat groups and that pagination request is still pending
- **THEN** the top-of-stream affordance becomes disabled
- **AND** its content switches from static button text to a loading treatment

### Requirement: Runtime Settings SHALL own durable recovery policy while Heartbeat quick config stays execution-scoped

The runtime shell SHALL keep Heartbeat quick config limited to next-call execution knobs, while durable recovery policy and provider transport retry editing SHALL live in the runtime Settings surface.

#### Scenario: Operator edits durable recovery policy from Settings

- **WHEN** the operator needs to change retry progression, backoff law, or provider transport retry behavior
- **THEN** the runtime Settings surface is the canonical editing entry
- **AND** the Heartbeat quick config does not expose those durable policy controls

#### Scenario: Heartbeat quick config remains scoped to next-call execution knobs

- **WHEN** the operator opens Heartbeat quick config after the retry-policy upgrade
- **THEN** the surface still only edits next-call execution knobs such as sampling or thinking settings
- **AND** it does not absorb durable recovery-policy responsibilities

### Requirement: Runtime Settings SHALL group durable runtime configuration by responsibility

The runtime Settings surface SHALL group durable runtime configuration into responsibility-based sections so provider transport, compact policy, retry policy, and prompt/locale settings are no longer mixed into one flat editing flow.

#### Scenario: Durable runtime settings open with sectioned ownership

- **WHEN** the operator opens the runtime Settings surface
- **THEN** the surface presents durable runtime configuration through clear responsibility-based sections
- **AND** the operator can distinguish provider transport settings from runtime retry policy without relying on implementation details

### Requirement: Studio Heartbeat migration SHALL wait for example acceptance

The first `web-heartbeat-view` apply phase SHALL NOT migrate Studio to consume `@agenter/web-heartbeat-view`. The package SHALL remain designed so Studio can later consume it through a thin adapter after `@agenter/web-heartbeat-view:example` is accepted. Until that follow-up is approved, Studio's existing runtime Heartbeat route remains the source for Studio behavior, while the package owns the new standalone Heartbeat presentation law.

#### Scenario: First apply leaves Studio route behavior untouched

- **WHEN** the first package/example implementation is applied
- **THEN** Studio is not required to import `@agenter/web-heartbeat-view`
- **AND** the existing Studio runtime Heartbeat route is not rewritten as part of the first acceptance slice

#### Scenario: Package boundary remains migration-ready

- **WHEN** the standalone example is accepted and a later Studio migration is considered
- **THEN** dependency direction remains `apps/studio` importing `@agenter/web-heartbeat-view`
- **AND** `@agenter/web-heartbeat-view` does not import Studio feature files, Studio routes, or Studio stores

#### Scenario: Deferred migration records the drift risk

- **WHEN** first-phase implementation copies Studio Heartbeat code into the package
- **THEN** the change records that Studio migration is deferred by user decision
- **AND** any remaining Studio/package parser drift is treated as a follow-up migration risk rather than hidden first-phase scope
