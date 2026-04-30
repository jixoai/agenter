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

### Requirement: Runtime clients SHALL publish one Heartbeat message-parts slice

The runtime client SHALL hydrate, merge, and republish one session-local Heartbeat slice backed by the runtime Heartbeat inspection API and realtime events. The Heartbeat surface SHALL no longer depend on assembling separate chat, request-aux, and model-call slices in the browser, and the inspection API SHALL include every durable ingress scope needed by the Heartbeat panel.

#### Scenario: Cold hydration loads one unified Heartbeat slice

- **WHEN** the operator opens a runtime route from a cold browser state
- **THEN** the runtime client hydrates the session's Heartbeat from one paged Heartbeat inspection API
- **AND** that API includes the persisted rows needed by the Heartbeat panel across legacy `heartbeat`, structured `heartbeat_part`, and `request_aux`
- **AND** the selected Heartbeat surface receives one ordered slice instead of three independently fetched inspection slices

#### Scenario: Live Heartbeat ingress rows merge into the existing session slice

- **WHEN** the runtime durably records a new or updated Heartbeat ingress row for an already hydrated session
- **THEN** the runtime publishes a realtime Heartbeat event for that row whenever the row does not already have a richer structured twin
- **AND** the client merges that row into the existing Heartbeat slice by durable message identity

#### Scenario: Loading older Heartbeat history preserves stream order

- **WHEN** the operator asks Heartbeat to load older history
- **THEN** the client requests older rows from the same Heartbeat inspection API
- **AND** the merged session-local Heartbeat slice remains ordered from oldest to newest after the older rows are inserted

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

### Requirement: Runtime clients SHALL project Heartbeat into grouped inspection pages

Runtime inspection consumers SHALL read Heartbeat as grouped pages instead of directly rendering paged raw parts. The grouped page contract SHALL be served from bounded storage reads and SHALL NOT require full-session reconstruction before returning the recent page.

#### Scenario: Heartbeat pages render one shared header per grouped fact cluster

- **WHEN** durable Heartbeat/request-aux facts for one AI call are queried for inspection
- **THEN** the runtime projects them into `before-call`, `call`, or `compact` groups
- **AND** the UI renders one shared header per group instead of repeating call-level chrome on every row

#### Scenario: Heartbeat shows pending pre-call facts even without a following model call

- **WHEN** request-side configuration or loose Heartbeat facts change but no next AI call has started yet
- **THEN** the grouped Heartbeat query returns a `before-call-pending` group
- **AND** the operator can inspect those facts before the next model invocation exists

#### Scenario: Realtime Heartbeat changes refresh the grouped projection

- **WHEN** a realtime `runtime.heartbeatPart` event arrives
- **THEN** the client treats it as an invalidation signal for grouped Heartbeat data
- **AND** the visible Heartbeat stream is reloaded from the grouped query path instead of merging raw parts locally

#### Scenario: Heartbeat recent page is served from bounded history

- **WHEN** the operator opens Heartbeat for a session with deep `ai_call`, `heartbeat_part`, and `request_aux` history
- **THEN** the backend reads only the storage window needed for the requested grouped page plus any minimal comparison baseline needed to preserve grouping truth
- **AND** it does not materialize the full session inspection history before returning the recent grouped page
- **AND** the returned groups still preserve `before-call`, `call`, `compact`, and `before-call-pending` semantics

#### Scenario: Loading older Heartbeat history expands by page instead of replaying all history

- **WHEN** the operator asks Heartbeat to load older grouped history
- **THEN** the backend expands the grouped query window only enough to satisfy that older page
- **AND** it does not rebuild the entire Heartbeat grouping for every pagination request

#### Scenario: Deep grouped Heartbeat history still settles route hydration

- **WHEN** the browser hydrates Heartbeat for a session with long inspection history
- **THEN** the grouped Heartbeat request resolves with data or an explicit error
- **AND** the operator does not remain indefinitely on `Loading Heartbeat…` because the backend is rebuilding full history in memory

#### Scenario: Heartbeat route hydrates only route-owned history

- **WHEN** the browser opens the Heartbeat route for a session with large persisted history
- **THEN** the route fetches grouped Heartbeat data plus the minimal model-call context needed by the Heartbeat status surface
- **AND** it does not piggyback `chat.list`, scheduler logs, observability traces, request-aux timelines, or API-call timelines onto the same cold start

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

### Requirement: Runtime clients SHALL publish grouped Heartbeat resource state explicitly

The runtime client SHALL expose grouped Heartbeat inspection data as a cached resource with explicit `loaded`, `loading`, `refreshing`, `error`, and `data` facts. Grouped Heartbeat consumers SHALL no longer infer load state from whether the current page array happens to be empty.

#### Scenario: Cold grouped Heartbeat hydration carries explicit load state

- **WHEN** a session runtime is hydrated from a cold browser state
- **THEN** the grouped Heartbeat slice starts in an unloaded/loading state
- **AND** it transitions to loaded-empty, loaded-with-data, or error explicitly after the grouped page request settles

#### Scenario: Realtime invalidation refreshes the grouped resource without dropping warm data

- **WHEN** a realtime Heartbeat invalidation refreshes an already loaded grouped slice
- **THEN** the runtime client marks the grouped Heartbeat resource as refreshing
- **AND** it preserves the currently loaded grouped rows until fresher grouped data arrives or the refresh fails

### Requirement: Runtime publication SHALL expose a manual compact action path

Runtime UI consumers SHALL be able to request a manual compact cycle through the runtime control plane without constructing transcript content to do so.

#### Scenario: UI requests a manual compact cycle

- **WHEN** a runtime UI consumer submits a manual compact request for one session
- **THEN** the runtime transport accepts that request through a formal control mutation
- **AND** the session runtime queues a manual compact cycle without requiring a chat-authored `/compact` message

### Requirement: Runtime clients SHALL expose next-call config edits as grouped Heartbeat facts

Heartbeat operators SHALL be able to change next-call model knobs from the Heartbeat surface without rewriting the current streaming call.

#### Scenario: Saving config shows a pending grouped fact immediately

- **WHEN** the operator saves new `temperature`, `top-k`, `max tokens`, or `thinking` settings from the Heartbeat surface
- **AND** the active runtime is scoped to avatar-level durable settings
- **THEN** the save lands in the avatar settings layer instead of mutating `ai.providers.*`
- **AND** runtime knobs persist under top-level `ai.temperature`, `ai.topK`, `ai.maxToken`, and `ai.thinking`
- **THEN** the grouped Heartbeat query exposes a trailing `before-call-pending` group immediately
- **AND** that group contains the durable `request_aux:config:*` fact that was just written
- **AND** the currently streaming call, if any, keeps rendering with its original config snapshot

### Requirement: Runtime clients SHALL keep older-page loading attached to the top of the Heartbeat stream

Grouped Heartbeat pagination SHALL be exposed from the scroll surface itself instead of the footer.

#### Scenario: Top-of-stream paging affordance shows availability objectively

- **WHEN** the operator scrolls to the top of the grouped Heartbeat stream and older grouped pages exist
- **THEN** the UI shows a centered `Load older` affordance near the top edge of the stream
- **AND** after the final older page is loaded, that same affordance region shows `No older messages`

#### Scenario: Top-of-stream paging affordance shows active loading state objectively

- **WHEN** the operator requests older grouped Heartbeat history from that top affordance
- **THEN** the same top affordance region switches into a disabled loading indicator while the request is in flight
- **AND** the already visible grouped Heartbeat rows stay mounted below that loading region
