## ADDED Requirements

### Requirement: Shell-next SHALL own terminal-room lifecycle reaction in product code

Shell-next SHALL own the application-specific binding between its terminal instance and room instance. Core systems SHALL expose lifecycle events and owner APIs, but shell-next SHALL implement the reaction `bound terminal killed -> archive bound room` in shell-next product code through public API/event contracts. The core product-extension runtime SHALL NOT contain a shell-next-specific lifecycle reaction host.

#### Scenario: Bound terminal death archives the shell-next room

- **GIVEN** shell-next has a product binding that names a terminal instance and a room instance
- **WHEN** shell-next observes through public terminal lifecycle events that the bound terminal is killed
- **THEN** shell-next calls the public room archive API for the bound room
- **AND** the room archive lifecycle then triggers the normal kernel law that mutes the room attention context

#### Scenario: Unrelated terminal death does not archive the shell-next room

- **GIVEN** shell-next has a product binding that names terminal `A` and room `R`
- **WHEN** terminal `B` is killed
- **THEN** shell-next does not archive room `R`
- **AND** the product reaction is scoped only to the bound terminal instance

#### Scenario: Product reaction uses public APIs rather than core imports

- **WHEN** shell-next implements terminal killed -> archive bound room
- **THEN** it subscribes to terminal lifecycle and calls room archive through public SDK/control-plane contracts
- **AND** it does not import TerminalSystem, RoomManagement, MessageSystem, or AttentionSystem internals to implement the reaction
- **AND** core modules do not import shell-next product code

#### Scenario: Product binding does not define semantic conversation routing

- **GIVEN** shell-next exposes bound terminal and room references as product facts
- **WHEN** a user or Avatar chooses where to discuss work
- **THEN** product code treats the binding as lifecycle state only
- **AND** semantic routing remains governed by user instruction and AGENTER.mdx / Avatar reasoning
