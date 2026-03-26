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

