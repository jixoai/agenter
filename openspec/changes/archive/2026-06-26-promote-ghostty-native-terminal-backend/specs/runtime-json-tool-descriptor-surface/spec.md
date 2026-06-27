## MODIFIED Requirements

### Requirement: Runtime terminal descriptors SHALL expose transition-aware config commands

Descriptor-backed runtime terminal CLI and loopback-local API routes SHALL expose `terminal get-config` and `terminal set-config` for durable terminal launch/config truth, including an explicit `backend` field in the shared config contract.

#### Scenario: Terminal set-config exposes backend in the shared schema

- **WHEN** the AI inspects `terminal set-config --help` or the generated descriptor schema
- **THEN** the input schema includes explicit `backend`
- **AND** that field reuses the shared terminal backend enum law instead of a descriptor-local string alias

### Requirement: Runtime terminal descriptors SHALL expose backend-aware create commands

Descriptor-backed runtime terminal create routes SHALL accept explicit backend selection as part of durable launch truth.

#### Scenario: Terminal create help exposes backend selection

- **WHEN** the AI runs `terminal create --help`
- **THEN** the generated schema includes optional `backend`
- **AND** the help keeps backend selection in launch truth instead of conflating it with renderer preference
