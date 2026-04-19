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

The `Heartbeat` tab SHALL render one continuous runtime surface backed by durable `message-parts` truth. It SHALL show request-side auxiliary rows, AI-visible request/response rows, and compact boundaries in chronological order without rebuilding the primary story from mixed chat rows, request-aux cards, and model-call cards. The stream SHALL be hosted inside a virtualizable conversation container, and the stage SHALL expose a persistent footer statusbar for runtime context usage and attention-state summary.

#### Scenario: Heartbeat opens with folded auxiliary facts and durable AI-visible rows

- **WHEN** the operator opens `Heartbeat` for a session that already recorded `systemPrompt`, `tools`, `config`, request rows, response rows, or compact boundaries
- **THEN** the stage renders those rows from the durable Heartbeat `message-parts` stream in chronological order
- **AND** `systemPrompt`, `tools`, `config`, and `compact` rows are visually subordinate and collapsed by default
- **AND** AI-visible request/response rows remain readable as the primary stream content

#### Scenario: Heartbeat updates live without mixed inspection cards

- **WHEN** the runtime records a streamed assistant update or a new Heartbeat request row while the operator is watching the tab
- **THEN** the stage updates the affected durable Heartbeat row in place
- **AND** the operator does not need a separate model-call card to understand the live Heartbeat state

#### Scenario: Heartbeat keeps status signals outside the transcript

- **WHEN** the operator inspects the `Heartbeat` tab
- **THEN** the transcript scroll region ends above a fixed footer statusbar
- **AND** the footer can show the newest model-call usage context plus focused/background/muted attention counts without those signals becoming transcript rows

#### Scenario: Heartbeat virtualizes long runtime history without changing row semantics

- **WHEN** the durable Heartbeat stream contains a long message-part history
- **THEN** the stage virtualizes row mounting through its conversation container
- **AND** compact boundaries still render as boundary markers, tool activity still renders through the tool presentation, and thinking rows still render through reasoning presentation

#### Scenario: Heartbeat reuses the outer runtime surface instead of nesting another frame

- **WHEN** the operator opens the `Heartbeat` tab
- **THEN** the runtime body content sits flush inside the shared workbench body without route-local outer padding
- **AND** the Heartbeat stage does not add its own outer rounded border around the transcript surface

### Requirement: Heartbeat SHALL delegate transcript scrolling to the named anchored-scroll controller

The runtime Heartbeat surface SHALL consume the shared named trigger/query/controller runtime for grouped transcript scrolling. Latest follow, older reveal, load-older affordances, and scroll-to-latest affordances SHALL be driven through named triggers and an installed program instead of local imperative timeline control.

#### Scenario: Heartbeat scroll-to-latest is driven through the shared named runtime

- **WHEN** the operator activates Heartbeat's `Scroll to latest` affordance
- **THEN** the stage raises a named action trigger consumed by the installed program
- **AND** the stage does not directly issue a feature-local semantic viewport write

#### Scenario: Group prepend and append follow the named trigger program

- **WHEN** Heartbeat groups are prepended, appended, or replaced
- **THEN** the installed program derives the resulting scroll behavior from named query facts such as edge state, collection delta, and insert batches
- **AND** the grouped transcript does not keep a parallel local scroll controller path

### Requirement: Heartbeat footer SHALL present objective runtime status and context details

The `Heartbeat` footer SHALL derive its primary status label from runtime scheduler containment facts rather than from frontend inference over the latest model-call row. The same footer SHALL render context usage through the shared AI-elements `Context` composition, using the newest available model-call usage plus canonical provider metadata when that metadata exists. When provider metadata is incomplete, the footer SHALL keep the objective usage facts visible and SHALL disable, hide, or degrade the unavailable context details instead of inventing values.

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

### Requirement: Heartbeat footer context SHALL reset across compact boundaries while using the shared ai-elements surface

The `Heartbeat` footer SHALL render context usage through the shared ai-elements `Context` composition, and it SHALL treat a newest `compact` call as a hard boundary that resets visible usage facts instead of reusing the previous non-compact model call.

#### Scenario: Compact resets visible footer context usage

- **WHEN** the newest model call for a Heartbeat footer is `kind: compact`
- **THEN** the footer context becomes unavailable for the new prompt window
- **AND** it does not keep presenting the token usage from the prior non-compact call as current context truth

#### Scenario: Unavailable context still uses the shared trigger contract

- **WHEN** provider metadata is incomplete or the newest call is compact
- **THEN** the footer still renders the shared ai-elements Context trigger structure
- **AND** the trigger is disabled or visually unavailable instead of falling back to a bespoke local badge block

### Requirement: Heartbeat SHALL distinguish first-load, empty, refreshing, and error states

The `Heartbeat` tab SHALL project its grouped message-parts stream through an explicit resource state rather than treating `no groups mounted` as the only empty condition.

#### Scenario: First load is not mistaken for an empty ledger

- **WHEN** the operator opens `Heartbeat` before the first grouped Heartbeat page has loaded
- **THEN** the stage shows a loading state
- **AND** it does not show the `No Heartbeat rows yet` empty-state copy until the grouped resource has actually loaded empty

#### Scenario: Warm refresh preserves visible rows

- **WHEN** the grouped Heartbeat resource is already loaded and a refresh is triggered by realtime invalidation or manual pagination
- **THEN** the existing Heartbeat rows remain visible
- **AND** the stage only adds a secondary refresh signal instead of clearing the transcript back to blank or empty state

### Requirement: Heartbeat footer SHALL expose manual compact as a control action

The `Heartbeat` footer SHALL expose a dedicated compact action that triggers a manual compact cycle through runtime control rather than by inserting a chat command into the transcript.

#### Scenario: Operator triggers compact from the footer

- **WHEN** the operator clicks the `Compact` button in the Heartbeat footer
- **THEN** the runtime queues a manual compact request for that session
- **AND** the transcript does not gain a fake `/compact` user message just to trigger the cycle

#### Scenario: Compact boundary still appears as durable Heartbeat truth

- **WHEN** the manual compact request later completes
- **THEN** Heartbeat records and renders the resulting compact boundary in chronological order
- **AND** the boundary remains a normal durable Heartbeat fact rather than a special UI-only marker

### Requirement: Heartbeat grouped virtualization SHALL remeasure disclosure-driven height changes

Grouped Heartbeat virtualization SHALL preserve one virtualized conversation surface while still responding correctly to row-height changes caused by expand/collapse or layout-mode switches.

#### Scenario: Expanding a grouped Heartbeat card does not leave stale blank space

- **WHEN** the operator expands or collapses a Heartbeat group card within the virtualized stream
- **THEN** the virtualized conversation recalculates the affected row height
- **AND** the scroll range does not retain stale whitespace below the final visible rows

### Requirement: Heartbeat stage SHALL stay shrinkable while its inner conversation owns scroll

The Heartbeat route stage SHALL stay shrinkable inside the shared runtime shell so the inner conversation viewport remains the only transcript scroll owner.

#### Scenario: Inner transcript scroll does not force the stage to expand past the shell body

- **WHEN** the Heartbeat tab mounts a virtualized conversation surface inside the runtime body
- **THEN** the stage itself remains shrinkable within the shared workbench body
- **AND** the transcript scroll ownership stays inside the inner conversation viewport instead of escaping to an outer route wrapper

### Requirement: Heartbeat compact cycles SHALL render as one special card

The Heartbeat surface SHALL render a compact cycle as one special card that keeps the compact prompt facts and the compact result in the same visual event.

#### Scenario: Compact mode folds compact prompt facts into one card

- **WHEN** a `before-call` prompt-fact group immediately precedes a `compact` group for the same `aiCallId`
- **THEN** the Heartbeat surface renders one compact card instead of two separate cards
- **AND** compact mode keeps the prompt facts folded while still showing the compact result clearly

#### Scenario: Detailed mode reveals the exact compact prompt facts in the same card

- **WHEN** the operator switches that compact card into detailed mode
- **THEN** the same card reveals the compact system prompt, tool inventory, and other prompt facts
- **AND** the operator still sees the compact result in chronological context without leaving that card

### Requirement: Heartbeat tool rows SHALL expose running intent objectively

The Heartbeat surface SHALL expose a running tool row as `Running` as soon as the durable row already contains meaningful invocation parameters.

#### Scenario: Parameters are visible before completion

- **WHEN** the Heartbeat surface renders a running tool row with durable parameters but no result yet
- **THEN** the row label shows that the tool is running
- **AND** the parameters are visible on that same row before the final result arrives

### Requirement: Heartbeat top paging SHALL keep one dedicated loading affordance

The top-of-stream older-page affordance SHALL stay above the grouped Heartbeat cards and SHALL switch into a disabled loading affordance while an older-page request is in flight.

#### Scenario: Older-page loading stays attached to the top of the stream

- **WHEN** the operator requests older grouped Heartbeat history from the top affordance
- **THEN** the same top affordance region shows a loading indicator in the disabled state
- **AND** the first visible Heartbeat group stays below that loading region instead of overlapping it

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
