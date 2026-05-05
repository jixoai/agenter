## ADDED Requirements

### Requirement: Shared-terminal collaboration validation SHALL pass with live runtime loops

Backend and real-provider shared-terminal validation SHALL prove shared-terminal collaboration under live runtime conditions rather than relying on pre-emptive runtime pausing as a hidden harness shortcut.

#### Scenario: Shared-terminal collaboration passes without pause shortcut
- **WHEN** a validation flow creates two runtime sessions, connects them through one room, shares one terminal, and lets the invitee write terminal input
- **THEN** both participants can observe the same terminal truth
- **AND** the validation does not require `session.pause()` to keep the runtime stable enough for that collaboration proof

#### Scenario: Runtime terminal follow-up remains bridge-governed during validation
- **WHEN** live runtime validation observes terminal changes during shared-terminal collaboration
- **THEN** any runtime follow-up caused by those changes only occurs through bridge-approved terminal ingress
- **AND** the validation can distinguish terminal collaboration success from independent AI-loop activity

### Requirement: Terminal-backed validation SHALL report process hygiene evidence

Terminal-backed validation flows SHALL capture process hygiene evidence so failures can distinguish runtime-law regressions from environment heat, port conflicts, or leaked background tasks.

#### Scenario: Validation reports port and process ownership evidence
- **WHEN** a terminal-backed validation fails because a promised local service is unreachable or the environment is already occupied
- **THEN** the failure report includes relevant port/process ownership evidence for the validation run
- **AND** engineers can distinguish code regressions from pre-existing background resource conflicts

#### Scenario: Validation reports cleanup state
- **WHEN** a terminal-backed validation completes or aborts
- **THEN** the harness reports whether validation-owned background processes were cleaned up
- **AND** leftover processes from unrelated worktrees or editor sessions remain explicitly identified as external to the current validation run
