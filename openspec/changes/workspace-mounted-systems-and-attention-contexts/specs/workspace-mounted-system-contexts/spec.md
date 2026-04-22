# workspace-mounted-system-contexts Specification

## Requirements

### Requirement: Mounted workspaces SHALL be able to instantiate System adapters from file-backed settings
Mounted workspaces SHALL be able to declare System instances from workspace-local settings files such as `settings.local.json`, rather than relying only on root-owned runtime injection.

#### Scenario: Mounted settings declare a system instance
- **GIVEN** a mounted workspace contains a valid `settings.local.json` with one declared System configuration
- **WHEN** the runtime loads mounted workspace systems
- **THEN** it instantiates the matching System adapter from that file-backed truth

### Requirement: Mounted workspace systems SHALL publish attention through shared adapters
Mounted workspace systems SHALL contribute AttentionContexts and/or AttentionItems through the shared attention law rather than injecting raw prompt glue.

#### Scenario: Mounted system publishes an AttentionContext
- **GIVEN** a mounted workspace system is active
- **WHEN** it has an AI-visible snapshot to publish
- **THEN** it publishes that snapshot as an AttentionContext through the shared adapter contract

### Requirement: Workspace unmount SHALL mute mounted-system contexts instead of deleting them
Unmounting a workspace SHALL mute the related mounted-system AttentionContexts while preserving durable history.

#### Scenario: Unmount hides but preserves mounted-system context history
- **GIVEN** a mounted workspace system already published one AttentionContext
- **WHEN** the workspace is unmounted
- **THEN** the related AttentionContext becomes muted
- **AND** the runtime preserves its durable history for later remount/resume
