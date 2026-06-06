## Purpose

Define how runtime facts are published to the WebUI so hot session activity updates only the affected surfaces.
## Requirements

### Requirement: Runtime clients SHALL publish scoped UI updates

The runtime client SHALL expose subscription primitives that let WebUI surfaces observe narrow runtime slices so hot updates from one session do not force unrelated application surfaces to rerender.

#### Scenario: Unrelated shell surfaces stay stable during session activity
- **WHEN** a hot runtime event burst updates one session's terminal, cycle, notification, or message state
- **THEN** WebUI surfaces that do not subscribe to that session-specific slice do not receive a fresh selected value
- **THEN** unrelated shell chrome such as inactive routes or unrelated workspace lists can remain stable

#### Scenario: Unchanged selector results are not republished
- **WHEN** runtime facts update without changing the selected value for a subscriber
- **THEN** the runtime client does not republish a fresh React-facing value for that selector
- **THEN** subscribers depending on that selector can preserve render stability

#### Scenario: Active route tabs subscribe only to active heavy slices
- **WHEN** a route contains multiple heavy inspection tabs backed by different runtime slices
- **THEN** the active tab subscribes only to the slices needed for its visible panel
- **THEN** inactive tabs do not receive fresh selected values for unrelated hot slices

### Requirement: Runtime publication SHALL coalesce hot event bursts

The runtime client SHALL coalesce listener publication for hot runtime bursts while preserving the latest consistent state.

#### Scenario: Multiple runtime events publish one coalesced update
- **WHEN** the client receives multiple hot runtime events within one publication window
- **THEN** the store applies all facts in order
- **THEN** subscribed UI listeners are notified with the latest consistent state instead of one React-facing publication per event

#### Scenario: Coalescing does not lose the final observed fact
- **WHEN** multiple runtime updates affect the same selected slice within one publication window
- **THEN** the subscriber observes the final state after the burst
- **THEN** no persisted runtime fact is dropped from the store

### Requirement: Runtime publication SHALL preserve long-history chat continuity

The runtime client SHALL merge persisted chat hydration, older-page pagination, and live runtime events into one stable session-local chat state for the active route.

#### Scenario: Persisted hydration and live events do not drop the visible chat state
- **WHEN** the active Chat route hydrates persisted history and then receives new runtime `chat.message` events
- **THEN** the session-local chat state contains both the hydrated persisted rows and the later live rows in chronological order
- **THEN** the route does not temporarily collapse to an empty chat state during that transition

#### Scenario: Loading older pages keeps the session-local chat projection ordered
- **WHEN** the client prepends older persisted chat pages for one session
- **THEN** the merged chat state remains ordered from oldest to newest within that session
- **THEN** the latest visible conversation rows stay available to the route while older rows are inserted

### Requirement: Runtime publication SHALL expose diagnostics for selector churn

The runtime client SHALL expose diagnostics metadata that lets performance tooling inspect why a hot slice is being republished.

#### Scenario: Diagnostics identify repeated selector publication
- **WHEN** a developer inspects runtime publication diagnostics for an active surface
- **THEN** the system reports publication counts for the selected slice
- **THEN** the reported diagnostics can distinguish steady-state idleness from hot republish churn

### Requirement: Heavy runtime slices SHALL stay cold when their surfaces are inactive

The runtime client SHALL avoid hydrating or republishing heavy route-local slices for surfaces that are not visible or not active.

#### Scenario: Inactive technical tabs stay cold
- **WHEN** a route exposes multiple heavy panels but only one panel is currently visible
- **THEN** inactive panels do not subscribe to or hydrate their heavy runtime slices
- **THEN** their data remains fetchable when the user explicitly activates that panel

### Requirement: Runtime clients SHALL publish scheduler containment state

The runtime client SHALL publish the session scheduler control state and wake metadata needed to explain why a session is running, waiting, backing off, blocked, paused, or aborted.

#### Scenario: Waiting and backoff are observable without trace inference
- **WHEN** a session runtime transitions into `waiting`, `backoff`, or `blocked`
- **THEN** subscribed UI consumers receive the new control state together with `wakeCause`, `retryCount`, `blockedReason`, and `nextWakeAt` when available
- **THEN** the UI can explain the containment state without reconstructing it from raw trace events

#### Scenario: Progress metadata updates only when the control state changes
- **WHEN** runtime facts update without changing the published scheduler containment state for a subscriber
- **THEN** the runtime client does not republish a fresh containment object for that selector
- **THEN** UI surfaces that inspect scheduler state remain eligible for render stability

### Requirement: Runtime publication SHALL keep attention, scheduler, and explicit effects distinguishable
Runtime-facing UI publication SHALL keep objective attention facts, scheduler signals, and explicit delivery/effect ledger facts in distinct payloads or distinct normalized slices. UI surfaces SHALL not need to reverse-engineer explicit effects from attention commits or scheduler state.

#### Scenario: Delivery ledger renders explicit effects without obligation labels
- **WHEN** a runtime attention surface renders delivery diagnostics for one context
- **THEN** it can show projections, dispatches, receipts, watches, and explicit effects from delivery publication
- **AND** it does not depend on removed labels such as `room_reply_pending`, `self_update`, or `no_external_reply_needed`

#### Scenario: Mobile and desktop surfaces preserve the same evidence
- **WHEN** runtime inspection surfaces are rendered in compact or full layouts
- **THEN** both layouts still expose room facts, terminal facts, skill-index churn, watch reminders, and explicit effect evidence
- **AND** layout density changes do not collapse those facts back into hidden heuristics or missing actions

### Requirement: Runtime clients SHALL publish one Heartbeat record resource family

The runtime client SHALL hydrate, merge, and republish one session-local Heartbeat record resource family backed by the Heartbeat record projection and realtime invalidation. That family SHALL include exact count/page facts for the list surface, page-anchor state, and separately addressable record detail. The Heartbeat surface SHALL no longer depend on browser-side regrouping of raw `heartbeat`, `heartbeat_part`, `request_aux`, chat, or model-call histories just to construct the list view.

#### Scenario: Cold hydration loads count and latest record page together

- **WHEN** the operator opens a runtime route from a cold browser state
- **THEN** the runtime client hydrates the session's Heartbeat count, the latest record page window, and anchor state from the Heartbeat record contract
- **AND** the selected Heartbeat surface receives record rows rather than three independently merged history slices

#### Scenario: Live record updates merge by record identity or invalidate fixed history honestly

- **WHEN** the runtime durably records a new or updated Heartbeat source fact for an already hydrated session
- **THEN** the runtime publishes a realtime invalidation or patch scoped to the affected record identity
- **AND** the latest anchored page can merge that update in place
- **AND** a fixed historical page remains pinned and instead receives `newRecordsAvailable` state when newer records landed elsewhere

### Requirement: Runtime clients SHALL surface running tool params from durable invocation rows

The runtime client and Heartbeat UI SHALL render the invocation-first Heartbeat ledger directly, so operators can inspect tool intent before the tool finishes. When a running invocation row receives richer durable input after the initial `tool_call` start event, the grouped Heartbeat publication SHALL republish that same invocation row in place without waiting for completion and without moving it into a new group or a second visual row.

#### Scenario: Heartbeat shows running invocation intent before completion

- **WHEN** a tool invocation row exists with only a `tool_call` part and hydrated parameters
- **THEN** the Heartbeat UI shows the invocation as running
- **AND** the operator can inspect the tool parameters immediately
- **AND** the UI does not wait for a `tool_result` before exposing that intent

#### Scenario: Later argument hydration updates the same running row

- **WHEN** the provider first emits a running `tool_call` row with empty or partial arguments and later durable updates hydrate richer invocation input for the same `invocationId`
- **THEN** the runtime publication path republishes the grouped Heartbeat data for that same invocation row while it is still running
- **AND** the Heartbeat UI reveals the hydrated parameters on the existing running row
- **AND** the operator does not need to wait for invocation completion to inspect those parameters

#### Scenario: Invocation completion upgrades the same visual row

- **WHEN** the durable invocation row later receives a `tool_result` part
- **THEN** the existing Heartbeat visual row upgrades from running to completed
- **AND** the UI does not create a second row for the same invocation

### Requirement: Runtime Heartbeat publication SHALL preserve assistant response segments objectively

The runtime Heartbeat ledger SHALL persist assistant `thinking` and `text` spans as chronological response segments instead of collapsing them into one mutable assistant snapshot for the whole AI call.

#### Scenario: Thinking can resume after a tool boundary without losing order

- **WHEN** one AI call emits `thinking`, then a tool invocation, then more `thinking`, then final assistant text
- **THEN** the durable Heartbeat ledger preserves those assistant spans as separate chronological response segments
- **AND** later inspection can reconstruct the objective order without guessing from the latest aggregate assistant body

### Requirement: Runtime clients SHALL publish Heartbeat record pages and detail separately

Runtime inspection consumers SHALL read Heartbeat through bounded record pages plus separate record detail instead of one grouped-stream payload that must serve both list and full inspection. The recent record page SHALL be served from bounded `heartbeat_record` reads, while detail SHALL resolve from record source refs or a detail projection derived from those refs. Historical page queries SHALL not rebuild the entire session grouping graph for every pagination request.

#### Scenario: Recent record pages are served from bounded record reads

- **WHEN** the operator opens Heartbeat for a session with deep history
- **THEN** the backend reads only the `heartbeat_record` window needed for the requested page plus minimal count metadata
- **AND** it does not regroup the full session before returning the recent page

#### Scenario: Detail resolves separately from source-backed evidence

- **WHEN** the operator selects one record for deeper inspection
- **THEN** the runtime fetches detail by record identity
- **AND** that detail resolves full structured content from source refs or a dedicated detail projection
- **AND** the list page payload does not need to inline the same long bodies

### Requirement: Grouped Heartbeat projection SHALL compare auxiliary facts by payload truth

Grouped Heartbeat publication SHALL deduplicate ordinary request-side auxiliary facts by payload equivalence rather than by message-id churn, while still attaching compact-specific prompt facts to the compact call that uses them.

#### Scenario: Unchanged ordinary prompt facts do not create a fresh before-call replay

- **WHEN** two consecutive ordinary AI calls reuse the same durable `systemPrompt`, `tools`, or `config` payloads
- **THEN** the grouped Heartbeat projection does not emit a new `before-call` replay just because the durable auxiliary message ids changed
- **AND** only materially changed auxiliary facts appear as new pre-call rows

#### Scenario: Compact-specific prompt facts stay attached to the compact call

- **WHEN** a compact cycle records compact-only prompt facts and then records the compact boundary/result
- **THEN** the grouped Heartbeat projection keeps those compact prompt facts attached to the compact call
- **AND** the operator does not need to read a separate ordinary `before-call` card to understand that compact event

### Requirement: Runtime clients SHALL publish Heartbeat record resource state explicitly

The runtime client SHALL expose Heartbeat record publication as explicit cached resources for count/page, anchor state, and selected detail, each with explicit `loading`, `loaded`, `refreshing`, `error`, and `data` facts as appropriate. Heartbeat consumers SHALL no longer infer load truth from whether the current row array happens to be empty or whether a detail panel happens to be closed.

#### Scenario: Cold list load is distinct from loaded empty

- **WHEN** a session runtime is hydrated from a cold browser state
- **THEN** the Heartbeat record page resource starts in an unloaded/loading state
- **AND** it transitions to loaded-empty, loaded-with-data, or error explicitly after the page request settles

#### Scenario: Warm page refresh and detail refresh stay independent

- **WHEN** a realtime invalidation refreshes an already loaded page while one detail panel is open
- **THEN** the runtime client can mark the page resource or detail resource as refreshing independently
- **AND** it preserves the warm page rows and current detail until fresher data or an error arrives

### Requirement: Runtime publication SHALL expose a manual compact action path

Runtime UI consumers SHALL be able to request a manual compact cycle through the runtime control plane without constructing transcript content to do so.

#### Scenario: UI requests a manual compact cycle

- **WHEN** a runtime UI consumer submits a manual compact request for one session
- **THEN** the runtime transport accepts that request through a formal control mutation
- **AND** the session runtime queues a manual compact cycle without requiring a chat-authored `/compact` message

### Requirement: Runtime clients SHALL expose next-call config edits as Heartbeat config records

Heartbeat operators SHALL be able to change next-call model knobs from the Heartbeat surface without rewriting the current streaming call, and the resulting durable fact SHALL publish as a `config` record rather than as a transient browser-only pending row.

#### Scenario: Saving config emits a config record immediately

- **WHEN** the operator saves new `temperature`, `top-k`, `max tokens`, `thinking`, prompt-source, or similar next-call settings from the Heartbeat surface
- **AND** the active runtime is scoped to avatar-level durable settings
- **THEN** the save lands in the avatar settings layer instead of mutating `ai.providers.*`
- **AND** the Heartbeat record publication emits or refreshes a trailing `config` record immediately
- **AND** the currently streaming call, if any, keeps rendering with its original config snapshot

### Requirement: Runtime clients SHALL publish Heartbeat page-window anchor state explicitly

The Heartbeat publication contract SHALL expose page-window anchor state explicitly, including at least whether the current view is `latest` or `fixed`, the exact current page window, whether older or newer windows are reachable, and whether newer records arrived while the operator stayed on a fixed historical page.

#### Scenario: Latest anchor state stays objective

- **WHEN** the operator is viewing the latest record page
- **THEN** the runtime publication identifies that page as `latest`
- **AND** newer record inserts advance that window instead of creating an ambiguous stale state

#### Scenario: Fixed anchor state reports reachable newer data

- **WHEN** the operator pins a historical page window and newer records are later materialized
- **THEN** the runtime publication keeps the current window marked as `fixed`
- **AND** it reports `newRecordsAvailable` without silently moving the operator to another page
