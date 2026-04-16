## MODIFIED Requirements

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
