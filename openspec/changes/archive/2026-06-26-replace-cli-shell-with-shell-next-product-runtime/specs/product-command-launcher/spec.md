## ADDED Requirements

### Requirement: App launcher SHALL keep shell2 as a daemon-backed incubation command

The app command launcher SHALL continue routing `shell2` to `agenter-app-shell-next` as a local incubation command until user acceptance. Once shell-next app attach is implemented, the `shell2` descriptor SHALL advertise daemon-backed runtime requirements without changing the stable `shell` descriptor.

#### Scenario: Shell2 descriptor remains separate from shell

- **WHEN** reviewers inspect app command descriptors during shell-next incubation
- **THEN** `shell2` resolves to `agenter-app-shell-next`
- **AND** `shell` still resolves to `agenter-app-shell`

#### Scenario: Shell2 descriptor advertises daemon-backed runtime after attach implementation

- **WHEN** shell-next default attach uses daemon/client-sdk app bootstrap
- **THEN** the `shell2` descriptor marks daemon use as required
- **AND** it advertises launch, resources, assistant, and attention runtime planes
