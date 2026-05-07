## ADDED Requirements

### Requirement: Workspace CLI helpcenter SHALL expose one grouped command catalog per workspace lens
The platform SHALL expose one structured workspace CLI catalog for the current workspace/avatar lens. That catalog SHALL include `just-bash` builtins, descriptor-backed runtime CLI commands, and callable workspace tool commands, and it SHALL group those commands by their shell surface instead of mixing them into one flat undifferentiated list.

#### Scenario: Root/runtime groups include builtins and descriptor-backed CLI commands
- **WHEN** the operator or browser reads the workspace CLI catalog
- **THEN** the catalog includes a dedicated `just-bash builtins` group
- **AND** it includes a dedicated root-workspace runtime CLI group containing callable commands such as `workspace list`, `message send`, and `terminal create`
- **AND** it does not require the caller to reconstruct those command labels from raw shell text

#### Scenario: Workspace groups include public and private tool commands
- **WHEN** the current workspace exposes public and avatar-private tool files
- **THEN** the catalog returns separate groups for public and private workspace tool commands
- **AND** each returned row identifies the callable command label derived from that tool file

#### Scenario: Arbitrary PATH binaries stay out of the product command catalog
- **WHEN** a binary is available on PATH but is not a builtin, runtime CLI command, or workspace tool command
- **THEN** the workspace CLI catalog omits that binary
- **AND** the page remains a product/runtime truth surface instead of a generic system binary browser

### Requirement: Workspace tool metadata SHALL support structured description registration
Workspace file-backed tool commands SHALL support a sidecar metadata manifest so command discovery does not depend on parsing ad hoc help text. The minimum structured metadata SHALL be `name` plus `description`.

#### Scenario: Registered tool manifest supplies a structured description
- **WHEN** a workspace tool file has a valid sidecar manifest with `name` and `description`
- **THEN** the command catalog uses that structured description for the tool row
- **AND** the browser and shell helpcenter surface the same registered summary

#### Scenario: Legacy tool without manifest remains visible through a fallback description
- **WHEN** a callable workspace tool file has no valid sidecar manifest
- **THEN** the command catalog still lists that command
- **AND** it marks the row with a fallback description that states the tool has no registered helpcenter metadata

### Requirement: Shell and browser discovery SHALL share the same helpcenter truth source
The shell-level `helpcenter` command and the browser-facing workspace CLI query SHALL read from the same command catalog builder so command discovery stays objective across surfaces.

#### Scenario: helpcenter list matches the browser catalog groups
- **WHEN** the shell runs `helpcenter list` for one workspace lens
- **THEN** it prints the same group ordering and command set that the browser workspace CLI page receives
- **AND** builtins, runtime CLI commands, and workspace tool commands do not drift between the two surfaces

#### Scenario: Builtin detail points back to builtin help
- **WHEN** the shell or browser inspects one builtin command entry such as `cd`
- **THEN** the entry includes `help cd` as its detail hint
- **AND** the catalog does not pretend that builtin detail text is owned by the product registry
