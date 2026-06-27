## ADDED Requirements

### Requirement: Terminal control plane SHALL persist explicit backend selection as durable launch truth

The terminal control plane SHALL persist an explicit terminal `backend` field as part of durable launch truth. `backend` is separate from `rendererPreference`, `resolvedRenderer`, and runtime-observed identity. Create, list, get-config, and set-config surfaces SHALL all preserve the same backend truth.

#### Scenario: Create without backend uses the durable default
- **WHEN** an authorized caller creates a terminal without specifying `backend`
- **THEN** the control plane applies the durable default backend `xterm`
- **AND** the created terminal entry and config surfaces expose `backend = xterm`

#### Scenario: Create with ghostty-native persists the requested backend
- **WHEN** an authorized caller creates a terminal with `backend = ghostty-native`
- **THEN** the control plane persists `ghostty-native` as durable launch truth
- **AND** the created terminal entry and config surfaces expose `backend = ghostty-native`

#### Scenario: Get-config and list expose the same backend truth
- **WHEN** a caller lists terminals or requests config for an existing terminal
- **THEN** both surfaces expose the same durable `backend` value for that terminal
- **AND** the caller does not need to infer backend identity from renderer or process output

#### Scenario: Backend mutation updates next-bootstrap launch truth
- **WHEN** a caller updates terminal config from `backend = xterm` to `backend = ghostty-native`
- **THEN** the durable terminal record is updated without changing the terminal id
- **AND** later bootstrap uses the updated backend launch truth

#### Scenario: Backend mutation does not hot-swap a running terminal
- **WHEN** a caller updates the durable backend field for a running terminal
- **THEN** the running PTY keeps its current live backend session
- **AND** the updated backend takes effect only on the next bootstrap

#### Scenario: Unknown backend is rejected explicitly
- **WHEN** a caller requests terminal create or config mutation with an unsupported backend value
- **THEN** the control plane rejects the request with a clear unsupported-backend style error
- **AND** it does not silently coerce the request to `xterm`
