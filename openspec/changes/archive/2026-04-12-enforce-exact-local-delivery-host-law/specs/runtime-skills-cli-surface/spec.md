## ADDED Requirements

### Requirement: Runtime skills SHALL treat exact local URL host binding as delivery truth
When a room-visible delivery contract names a concrete local URL, the runtime skill surface SHALL treat that exact host and port as part of the promised fact rather than as interchangeable implementation details.

#### Scenario: Alternate localhost hosts do not satisfy a promised 127.0.0.1 URL
- **GIVEN** the promised delivery URL is `http://127.0.0.1:<port>/`
- **WHEN** the AI verifies `http://[::1]:<port>/` or `http://localhost:<port>/` successfully but the promised `http://127.0.0.1:<port>/` still fails
- **THEN** the runtime skills describe that situation as a failed delivery verification
- **AND** the AI is instructed to rebind or restart the service instead of announcing the room URL

#### Scenario: Built-in terminal skills show explicit bind examples for exact-host delivery
- **WHEN** the AI expands the built-in terminal/runtime skills for local service delivery
- **THEN** the examples include explicit bind forms such as `python3 -m http.server <port> --bind 127.0.0.1`
- **AND** the guidance states that the promised host must be verified exactly before `APP-URL:` / `PROJECT-URL:` is sent
