## ADDED Requirements

### Requirement: Agenter SHALL consume official Termless packages as the backend ownership layer

Agenter terminal products and runtime code SHALL treat official Termless packages as the only backend ownership layer. Agenter MUST NOT publish or depend on an Agenter-private package as the canonical authority for a backend already provided by Termless.

#### Scenario: Xterm backend resolves through the official Termless package

- **WHEN** a production Agenter package needs the current default xterm backend
- **THEN** it consumes official Termless backend entrypoints such as `@termless/xtermjs`
- **AND** it does not treat `@agenter/termless-xterm-backend` as the canonical backend authority

#### Scenario: Future ghostty-native adoption reuses the same ownership slot

- **WHEN** a future change adopts `@termless/ghostty-native`
- **THEN** that backend plugs into the same official Termless backend slot
- **AND** Agenter does not introduce a second package such as `@agenter/termless-ghostty-native-backend`

### Requirement: Agenter-local bridge code SHALL remain adapter-only

Agenter MAY implement local bridge modules that adapt official Termless backends to Agenter-facing runtime, transport, or rendering contracts. Those bridges SHALL remain adapter-only and MUST NOT redefine backend identity, backend capabilities, or backend package ownership.

#### Scenario: Consumer-local bridge adapts official backend without claiming authority

- **WHEN** `terminal-system` or `cli-shell` needs a readable or writable bridge shape that is not provided directly by Termless
- **THEN** the bridge may wrap an official backend instance behind an Agenter-local contract
- **AND** backend name, capabilities, and backend implementation truth still come from the official Termless backend

#### Scenario: Dependency audit rejects Agenter-private backend authority

- **WHEN** production dependency boundaries are reviewed for this change
- **THEN** no production package depends on `@agenter/termless-xterm-backend` as backend authority
- **AND** any remaining migration shim is treated as temporary cleanup work, not as durable platform law

### Requirement: The current default backend SHALL remain xterm until a later parity change

Correcting backend ownership SHALL NOT silently change the current default backend. Until a later parity change is specified and verified, Agenter SHALL continue using the official xterm backend as the default terminal backend.

#### Scenario: Ownership correction preserves the current backend default

- **WHEN** a terminal is created without an explicit backend override during this change
- **THEN** it uses the official xterm backend
- **AND** ownership correction does not silently promote another backend

#### Scenario: Backend promotion requires a separate verified change

- **WHEN** a future change wants to promote `ghostty-native` or another backend to the default slot
- **THEN** that change updates the backend-adoption law explicitly
- **AND** it brings parity evidence instead of inheriting promotion from this ownership refactor
