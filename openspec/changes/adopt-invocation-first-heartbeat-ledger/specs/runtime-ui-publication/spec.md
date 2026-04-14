## MODIFIED Requirements

### Requirement: Runtime clients SHALL surface running tool params from durable invocation rows

The runtime client and Heartbeat UI SHALL render the invocation-first Heartbeat ledger directly, so operators can inspect tool intent before the tool finishes.

#### Scenario: Heartbeat shows running invocation intent before completion

- **WHEN** a tool invocation row exists with only a `tool_call` part and hydrated parameters
- **THEN** the Heartbeat UI shows the invocation as running
- **AND** the operator can inspect the tool parameters immediately
- **AND** the UI does not wait for a `tool_result` before exposing that intent

#### Scenario: Invocation completion upgrades the same visual row

- **WHEN** the durable invocation row later receives a `tool_result` part
- **THEN** the existing Heartbeat visual row upgrades from running to completed
- **AND** the UI does not create a second row for the same invocation
