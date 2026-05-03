## MODIFIED Requirements

### Requirement: Runtime descriptors SHALL expose terminal config mutation through one shared schema-backed registry

The runtime SHALL define terminal config mutation through the shared descriptor registry, but the AI-facing public mutation surface SHALL only expose fields that belong to AI/tool-managed terminal truth. Renderer preference and terminal theme identity MUST remain terminal-system owned profile facts rather than AI-facing mutable descriptor fields.

#### Scenario: CLI and local API dispatch the same terminal config descriptor
- **WHEN** the runtime exposes terminal config mutation
- **THEN** the loopback-local API route, shell CLI subcommand, and help output are all derived from the same descriptor entry
- **AND** the descriptor does not maintain a second hand-written parser or route mapping

#### Scenario: AI-facing terminal config mutation omits renderer and theme ownership
- **WHEN** the AI inspects or uses the public runtime terminal config mutation command
- **THEN** the input schema omits durable renderer preference and terminal theme identity as mutable fields
- **AND** the descriptor does not imply that model-managed config owns renderer/theme law
