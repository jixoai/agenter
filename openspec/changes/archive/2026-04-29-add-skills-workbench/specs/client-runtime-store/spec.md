## ADDED Requirements

### Requirement: Client runtime store SHALL expose typed read-only skill browser queries

The client runtime store SHALL expose typed read-only methods for the browser skill surface instead of requiring feature routes to call raw transport clients directly. Those methods SHALL preserve the platform's objective skill/browser facts and SHALL NOT synthesize merged file trees or mutable skill truth in feature code.

#### Scenario: Skills route uses typed store facades for catalog and tree reads
- **WHEN** the Skills workbench needs a built-in, shared, global, or avatar skill catalog and file tree
- **THEN** it can obtain those facts through typed runtime store methods
- **AND** the route does not instantiate its own ad hoc transport layer

#### Scenario: Store methods preserve objective preview classification
- **WHEN** the Skills workbench reads one skill file preview through the runtime store
- **THEN** the returned preview kind and payload match the browser skill surface contract exactly
- **AND** the store does not reinterpret text vs media into multiple incompatible preview shells
