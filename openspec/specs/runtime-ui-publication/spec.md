## Purpose

Define how runtime facts are published to the WebUI so hot session activity updates only the affected surfaces.
## Requirements
### Requirement: Runtime clients SHALL publish scoped UI updates
The runtime client SHALL expose subscription primitives that let WebUI surfaces observe narrow runtime slices so hot updates from one session do not force unrelated application surfaces to rerender, while still allowing the active Chat route to hydrate the persisted facts it needs for a real session.

#### Scenario: Unrelated shell surfaces stay stable during session activity
- **WHEN** a hot runtime event burst updates one session's terminal, cycle, or notification state
- **THEN** WebUI surfaces that do not subscribe to that session-specific slice do not receive a fresh selected value
- **THEN** unrelated shell chrome such as inactive routes or unrelated workspace lists can remain stable

#### Scenario: Route-local hydration populates real-session chat history without broad shell churn
- **WHEN** the user opens or resumes one specific session route
- **THEN** the runtime client loads that session's persisted chat and cycle history into the route-local state it needs
- **THEN** unrelated shell layers do not rerender solely because another session route hydrated its history

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

