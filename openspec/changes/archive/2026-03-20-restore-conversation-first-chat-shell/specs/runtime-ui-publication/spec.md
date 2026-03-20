## MODIFIED Requirements

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
