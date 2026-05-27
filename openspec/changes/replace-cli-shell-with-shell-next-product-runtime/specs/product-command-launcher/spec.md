## ADDED Requirements

### Requirement: Product launcher SHALL keep shell2 as a daemon-backed incubation command

The product command launcher SHALL continue routing `shell2` to `agenter-ext-shell-next` as a local incubation command until user acceptance. Once shell-next product attach is implemented, the `shell2` descriptor SHALL advertise daemon-backed runtime requirements without changing the stable `shell` descriptor.

#### Scenario: Shell2 descriptor remains separate from shell

- **WHEN** reviewers inspect product command descriptors during shell-next incubation
- **THEN** `shell2` resolves to `agenter-ext-shell-next`
- **AND** `shell` still resolves to `agenter-ext-shell`

#### Scenario: Shell2 descriptor advertises daemon-backed runtime after attach implementation

- **WHEN** shell-next default attach uses daemon/client-sdk product bootstrap
- **THEN** the `shell2` descriptor marks daemon use as required
- **AND** it advertises launch, resources, assistant, and attention runtime planes
