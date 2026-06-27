# termless-backend-adoption Specification

## Purpose

Define the durable ownership boundary between Agenter terminal layers and official Termless backend packages.
## Requirements
### Requirement: Agenter SHALL consume official Termless packages as the backend ownership layer

Agenter terminal products and runtime code SHALL treat official Termless packages as the only backend ownership layer. Agenter MUST NOT publish or depend on an Agenter-private package as the canonical authority for a backend already provided by Termless.

#### Scenario: Xterm backend resolves through the official Termless package

- **WHEN** a production Agenter package needs the current default xterm backend
- **THEN** it consumes official Termless backend entrypoints such as `@termless/xtermjs`
- **AND** it does not treat `@agenter/termless-xterm-backend` as the canonical backend authority

#### Scenario: Explicit ghostty-native adoption reuses the same ownership slot

- **WHEN** a terminal product explicitly requests backend `ghostty-native`
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

#### Scenario: Explicit ghostty-native opt-in does not promote the default

- **WHEN** one terminal launch explicitly requests `backend = ghostty-native`
- **THEN** that terminal uses the official `@jixo/ghostty-native` backend
- **AND** later terminals created without explicit backend override still default to official xterm

#### Scenario: Explicit ghostty-native failure does not fall back silently

- **WHEN** a terminal explicitly requests `backend = ghostty-native`
- **AND** the current host cannot instantiate the official ghostty-native backend
- **THEN** Agenter returns a clear backend-unavailable style failure
- **AND** it does not silently substitute the official xterm backend as if the explicit request had succeeded

#### Scenario: Backend promotion requires a separate verified change

- **WHEN** a future change wants to promote `ghostty-native` or another backend to the default slot
- **THEN** that change updates the backend-adoption law explicitly
- **AND** it brings parity evidence instead of inheriting promotion from this ownership refactor

### Requirement: Agenter backend utility packages SHALL remain opt-in and non-authoritative

Agenter MAY publish backend utility packages for reusable adapters or optional behavior composition, but those packages SHALL remain opt-in utilities. They SHALL NOT redefine backend identity, backend capability truth, or global behavior that every backend must inherit.

#### Scenario: Core does not own optional input policy

- **WHEN** reviewers inspect `@agenter/termless-core`
- **THEN** it exposes terminal contracts and backend adapters
- **AND** it does not export optional host input controllers
- **AND** it does not force every backend to share one host input policy

#### Scenario: Utility package does not become backend authority

- **WHEN** reviewers inspect `@agenter/termless-backend-utils`
- **THEN** the package depends on `@agenter/termless-core` contracts
- **AND** it does not define backend names, backend registry entries, or default backend selection
- **AND** consumers must explicitly import and compose each utility they want

#### Scenario: Future backend can combine only needed utilities

- **GIVEN** a future backend such as a wezterm backend ships some of its own input handling
- **WHEN** it needs one missing behavior from Agenter utilities
- **THEN** it can compose that utility without also taking unrelated keyboard, pointer, selection, or clipboard policy
