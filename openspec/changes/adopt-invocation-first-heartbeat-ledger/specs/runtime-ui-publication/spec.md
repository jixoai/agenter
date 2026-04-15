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

### Requirement: Runtime clients SHALL project Heartbeat into grouped inspection pages

Runtime inspection consumers SHALL read Heartbeat as grouped pages instead of directly rendering paged raw parts.

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

### Requirement: Runtime clients SHALL expose next-call config edits as grouped Heartbeat facts

Heartbeat operators SHALL be able to change next-call model knobs from the Heartbeat surface without rewriting the current streaming call.

#### Scenario: Saving config shows a pending grouped fact immediately

- **WHEN** the operator saves new `temperature`, `top-k`, `max tokens`, or `thinking` settings from the Heartbeat surface
- **THEN** the grouped Heartbeat query exposes a trailing `before-call-pending` group immediately
- **AND** that group contains the durable `request_aux:config:*` fact that was just written
- **AND** the currently streaming call, if any, keeps rendering with its original config snapshot

### Requirement: Runtime clients SHALL keep older-page loading attached to the top of the Heartbeat stream

Grouped Heartbeat pagination SHALL be exposed from the scroll surface itself instead of the footer.

#### Scenario: Top-of-stream paging affordance shows availability objectively

- **WHEN** the operator scrolls to the top of the grouped Heartbeat stream and older grouped pages exist
- **THEN** the UI shows a centered `Load older` affordance near the top edge of the stream
- **AND** after the final older page is loaded, that same affordance region shows `No older messages`
