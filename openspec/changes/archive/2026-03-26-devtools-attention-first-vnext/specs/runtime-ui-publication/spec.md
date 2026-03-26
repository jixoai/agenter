## MODIFIED Requirements

### Requirement: Runtime clients SHALL publish scoped UI updates
The runtime client SHALL expose subscription primitives that let WebUI surfaces observe attention-native runtime slices so hot updates from one session or one Devtools panel do not force unrelated application surfaces to rerender.

#### Scenario: Unrelated shell surfaces stay stable during session activity
- **WHEN** a hot runtime event burst updates one session's attention, cycle, trace, terminal, or message state
- **THEN** WebUI surfaces that do not subscribe to that session-specific slice do not receive a fresh selected value
- **THEN** unrelated shell chrome such as inactive routes or unrelated workspace lists can remain stable

#### Scenario: Unchanged selector results are not republished
- **WHEN** runtime facts update without changing the selected value for a subscriber
- **THEN** the runtime client does not republish a fresh React-facing value for that selector
- **THEN** subscribers depending on that selector can preserve render stability

#### Scenario: Active Devtools panels subscribe only to active heavy slices
- **WHEN** a Devtools route contains multiple heavy inspection panels backed by different attention-native slices
- **THEN** the active panel subscribes only to the slices needed for its visible content
- **THEN** inactive panels do not receive fresh selected values for unrelated hot slices
