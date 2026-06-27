## MODIFIED Requirements

### Requirement: Agenter SHALL consume official Termless packages as the backend ownership layer

Agenter terminal products and runtime code SHALL treat official Termless packages as the only backend ownership layer. Agenter MUST NOT publish or depend on an Agenter-private package as the canonical authority for a backend already provided by Termless.

#### Scenario: Xterm backend resolves through the official Termless package

- **WHEN** a production Agenter package needs the current default xterm backend
- **THEN** it consumes official Termless backend entrypoints such as `@termless/xtermjs`
- **AND** it does not treat `@agenter/termless-xterm-backend` as the canonical backend authority

#### Scenario: Explicit ghostty-native backend resolves through the official Termless package

- **WHEN** a production Agenter package explicitly requests backend `ghostty-native`
- **THEN** it consumes official Termless backend entrypoints such as `@jixo/ghostty-native`
- **AND** it does not introduce a second package such as `@agenter/termless-ghostty-native-backend`

### Requirement: The current default backend SHALL remain xterm until a later parity change

Adding explicit `ghostty-native` support SHALL NOT silently change the current default backend. Until a later parity change is specified and verified, Agenter SHALL continue using the official xterm backend when no explicit backend override is present.

#### Scenario: Omitted backend keeps the current default

- **WHEN** a terminal is created without an explicit backend override during this change
- **THEN** it uses the official xterm backend
- **AND** ghostty-native support does not silently promote another backend

#### Scenario: Explicit ghostty-native opt-in does not promote the default

- **WHEN** one cli-shell launch explicitly requests `backend = ghostty-native`
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
- **AND** it brings parity evidence instead of inheriting promotion from this opt-in support change
