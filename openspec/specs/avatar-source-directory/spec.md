# avatar-source-directory Specification

## Purpose
Define the durable avatar directory contracts for subscribed sources, remote discovery, install-first acquisition, and provenance retention.

## Requirements

### Requirement: Avatar directory SHALL manage multiple subscribed avatar sources
The system SHALL support multiple subscribed avatar sources, and each source SHALL expose a human-recognizable alias suitable for display in the form of `scope/repo` or an equivalent source label.

#### Scenario: Operator reviews multiple subscribed sources
- **WHEN** the operator opens the avatar `Sources` surface
- **THEN** the UI lists each subscribed avatar source as its own source record
- **AND** each record exposes a distinguishable source alias instead of collapsing all remote supply into one unnamed bucket

#### Scenario: Source entry remains a visible app surface
- **WHEN** the operator navigates within the `Avatars` workbench
- **THEN** the app exposes a first-class `Sources` entry rather than hiding source management only inside unrelated settings

### Requirement: Discover SHALL present remote avatar packages as installable candidates
The system SHALL project remote avatar packages through a `Discover` surface. Discover rows SHALL treat package name as the primary identity cue and source alias as the secondary cue.

#### Scenario: Operator scans mixed-source discover results
- **WHEN** the operator views remote avatar packages from one or more subscribed sources
- **THEN** each row shows the avatar or package name as the dominant label
- **AND** the row shows the source alias as a secondary fact

#### Scenario: Discover does not reclassify packages as operational avatars yet
- **WHEN** the operator has not installed a remote avatar package
- **THEN** the package appears as a discoverable candidate in `Discover`
- **AND** it does not yet masquerade as an installed local avatar in `My Avatars`

### Requirement: Install SHALL create a local avatar using remote name by default
The primary durable acquisition flow for a remote avatar package SHALL be explicit install. Install SHALL default the local nickname to the remote package name and SHALL require rename only when that default name conflicts with an already installed local avatar.

#### Scenario: Install uses remote package name by default
- **WHEN** the operator installs a remote avatar package whose remote name does not conflict locally
- **THEN** the install flow preselects that remote name as the local avatar nickname
- **AND** the installation can complete without requiring manual rename

#### Scenario: Install prompts rename on local conflict
- **WHEN** the operator installs a remote avatar package whose default local nickname conflicts with an already installed local avatar
- **THEN** the install flow blocks silent overwrite
- **AND** it prompts the operator to provide a different local nickname before completing install

### Requirement: Installed remote packages SHALL retain provenance and remain fully equivalent to local avatars
Installing a remote avatar package SHALL produce a local avatar that retains source/package/revision provenance. After installation, the resulting avatar SHALL remain fully operable as a normal local avatar rather than as a second-class remote-only subtype.

#### Scenario: Installed avatar keeps provenance
- **WHEN** the operator installs a remote avatar package
- **THEN** the resulting local avatar record retains provenance facts including source identity and revision
- **AND** those facts remain available for future inspection or update logic

#### Scenario: Installed avatar behaves like a normal local avatar
- **WHEN** the operator later uses an installed avatar from `My Avatars`
- **THEN** the operator can launch and operate it through the same runtime and workspace flows used by purely local avatars
- **AND** the UI does not require a separate remote-only operational mode

### Requirement: Install SHALL be the default durable path even if transient launch exists later
The system MAY support transient direct launch of remote packages in the future, but the default durable app path for remote acquisition SHALL remain install-first.

#### Scenario: Discover emphasizes install as the primary durable action
- **WHEN** the operator inspects a remote avatar package in `Discover`
- **THEN** the surface presents install as the primary durable acquisition path
- **AND** it does not require transient remote launch to reach normal avatar operation
