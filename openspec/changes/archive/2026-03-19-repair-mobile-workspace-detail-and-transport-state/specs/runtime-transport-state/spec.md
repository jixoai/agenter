## ADDED Requirements

### Requirement: Runtime client SHALL expose an explicit transport status

The client runtime SHALL expose a transport lifecycle that distinguishes `connecting`, `connected`, `reconnecting`, and `offline`, and it SHALL continue to provide a derived `connected` compatibility flag for existing consumers.

#### Scenario: Initial connection reports connecting before the snapshot succeeds

- **WHEN** the client runtime begins establishing the transport
- **THEN** the runtime state reports `connectionStatus = connecting`
- **THEN** the derived `connected` flag remains `false` until the transport is ready

#### Scenario: Browser offline state is surfaced explicitly

- **WHEN** the browser reports an offline transition while the runtime is active
- **THEN** the runtime state reports `connectionStatus = offline`
- **THEN** the derived `connected` flag becomes `false`

#### Scenario: Reconnect backoff is distinct from offline

- **WHEN** the transport disconnects while the browser is still online
- **THEN** the runtime state reports `connectionStatus = reconnecting`
- **THEN** the runtime schedules reconnect attempts without claiming that the transport is connected

### Requirement: Retained live streams SHALL recover after reconnect

The client runtime SHALL restore retained live subscriptions after reconnect so that live Devtools data continues without requiring the route to remount.

#### Scenario: Retained API-call stream resumes after reconnect

- **WHEN** a session retains a live API-call stream and the transport reconnects successfully
- **THEN** the runtime re-subscribes that stream from the latest retained cursor
- **THEN** subsequent live API-call items continue to appear for that session

#### Scenario: Reconnect does not duplicate retained stream data

- **WHEN** the transport reconnects and retained streams are restored
- **THEN** the runtime does not create duplicate stream subscriptions for the same retained session
- **THEN** duplicate live API-call rows are not emitted into client state
