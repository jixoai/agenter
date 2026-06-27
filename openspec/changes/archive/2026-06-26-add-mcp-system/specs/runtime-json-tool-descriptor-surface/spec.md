## MODIFIED Requirements

### Requirement: Runtime SHALL define shell/API tool surfaces from a shared descriptor registry

The runtime SHALL define `attention`, `message`, `workspace`, `terminal`, `mcp`, and descriptor-backed `skill` shell/API operations from one shared descriptor registry that owns command name, description, input schema, route, and execution mapping.

#### Scenario: CLI and local API dispatch the same descriptor
- **WHEN** the runtime exposes `terminal write`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the system does not maintain a second hand-written parser or route mapping for that operation

#### Scenario: CLI and local API dispatch the mixed terminal input descriptor
- **WHEN** the runtime exposes `terminal input`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the system does not maintain a second hand-written parser or route mapping for that operation

#### Scenario: CLI and local API dispatch an MCP descriptor
- **WHEN** the runtime exposes `mcp query`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** mcpSystem does not maintain a second hand-written parser or route mapping for that operation

#### Scenario: CLI and local API preserve terminal input failure truth
- **WHEN** terminal-core rejects a pending-backed `terminal write` or `terminal input` payload
- **THEN** the shared descriptor surface reports that failure truth back to the caller
- **AND** it does not synthesize a successful `written` result for input that never reached the PTY

#### Scenario: Skill config mutation uses the same descriptor contract
- **WHEN** the runtime exposes `skill set-config`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the runtime does not maintain a second hand-written parser for the same config payload
