## ADDED Requirements

### Requirement: Shared terminal environments SHALL preserve real home semantics
When the runtime creates or recovers a shared terminal, it SHALL preserve the operator's real home-directory semantics unless the caller explicitly overrides `HOME`. Shared terminals are collaboration surfaces comparable to `public-workspace`, so the runtime MUST NOT rewrite `HOME` to the avatar root workspace and MUST NOT auto-mount root-workspace-exclusive CLI helpers or avatar-private control-plane env merely because the runtime has one fixed root workspace.

#### Scenario: New shared terminal keeps real home semantics
- **WHEN** the AI creates a terminal without explicitly setting `HOME`
- **THEN** the terminal environment preserves the real user home directory
- **AND** the runtime does not inject root-workspace-exclusive CLI/env by default

#### Scenario: Recovered shared terminal keeps the same home law
- **WHEN** the runtime recovers or recreates a previously attached terminal
- **THEN** it applies the same real-home default instead of avatar-root `HOME`
- **AND** recovery does not silently change terminal identity semantics

#### Scenario: Avatar-root cwd does not imply avatar-root HOME
- **WHEN** a shared terminal starts with `cwd` inside the avatar root workspace
- **THEN** the terminal still follows shared-terminal home semantics by default
- **AND** root-workspace `HOME` rewrite remains reserved for `root_bash`

#### Scenario: Shared terminal does not inherit root-exclusive CLI
- **WHEN** a shared terminal is created for collaborative work
- **THEN** root-workspace-only helper commands are not auto-mounted into that terminal
- **AND** terminal collaboration does not depend on avatar-private runtime CLI exposure
