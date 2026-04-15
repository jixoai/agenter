## MODIFIED Requirements

### Requirement: Heartbeat inspection SHALL page one merged message-parts stream

Runtime inspection SHALL expose one paged Heartbeat stream composed from durable `message_parts` rows instead of requiring the client to query chat rows, request-side auxiliary rows, and model-call rows separately.

#### Scenario: Heartbeat page excludes legacy wrapper scope

- **WHEN** a runtime inspection client pages Heartbeat rows for one session
- **THEN** it receives one chronological stream containing only `scope=heartbeat_part` rows and deduplicated `scope=request_aux` rows
- **AND** `scope=heartbeat` is not a valid Heartbeat durable source anymore
- **AND** the client does not need legacy wrapper-row compatibility logic to reconstruct Heartbeat
