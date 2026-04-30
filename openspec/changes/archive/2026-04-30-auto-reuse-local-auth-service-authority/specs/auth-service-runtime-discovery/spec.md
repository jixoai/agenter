## ADDED Requirements

### Requirement: Auth-service SHALL publish an authority-scoped runtime descriptor

When auth-service owns a writable authority root, it SHALL publish a runtime descriptor in that same root so local runtimes can discover the authority without guessing a port. The descriptor SHALL identify the current endpoint and ownership facts for that authority instance.

#### Scenario: Running auth-service writes a reusable local descriptor
- **WHEN** auth-service starts and begins serving traffic for one authority root
- **THEN** it writes a runtime descriptor in that authority root
- **AND** the descriptor includes the current `endpoint`, `pid`, `dataDir`, `rootAuthKeyPath`, and `updatedAt`

#### Scenario: Auth-service stop clears its owned descriptor
- **WHEN** the auth-service instance that owns a runtime descriptor stops cleanly
- **THEN** it removes only the descriptor record that it owns
- **AND** it does not delete a descriptor written by a different running owner

### Requirement: Local runtime discovery SHALL require health confirmation

A local runtime descriptor by itself SHALL NOT authorize reuse. Consumers SHALL confirm that the advertised endpoint is healthy before treating the descriptor as a reusable authority.

#### Scenario: Stale descriptor is ignored
- **WHEN** a local descriptor exists but its endpoint is no longer healthy
- **THEN** consumers ignore that descriptor as a reusable authority
- **AND** the stale file does not block later startup or reuse of a healthy authority
