## ADDED Requirements

### Requirement: Runtime terminal descriptors SHALL distinguish live bootstrap from killed recovery
Descriptor-backed terminal lifecycle commands SHALL distinguish ordinary live `not_started` bootstrap from killed-history recovery. Generated help and descriptor metadata MUST NOT teach killed-history bootstrap as the normal way to continue work after terminal death.

#### Scenario: Bootstrap help prefers live not-started terminals
- **WHEN** the AI runs `terminal bootstrap --help`
- **THEN** the help describes bootstrap as the normal lifecycle edge for live `not_started` terminals
- **AND** it does not describe killed-history bootstrap as an ordinary resume path

#### Scenario: Killed recovery requires explicit descriptor intent
- **WHEN** the AI invokes a descriptor-backed lifecycle command for a killed terminal
- **THEN** the descriptor validates an explicit killed-history recovery intent before dispatch
- **AND** a request without that intent fails before silently reviving the terminal

#### Scenario: Terminal list help remains live-only
- **WHEN** the AI runs `terminal list --help`
- **THEN** the help states that `terminal list` returns live terminals only
- **AND** it points killed inspection to explicit history or index commands
