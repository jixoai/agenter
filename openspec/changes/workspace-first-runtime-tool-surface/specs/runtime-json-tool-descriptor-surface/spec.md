# runtime-json-tool-descriptor-surface Specification

## MODIFIED Requirements

### Requirement: Workspace descriptors SHALL cover mounted workspace inspection and alias mutation
The shared runtime descriptor registry SHALL define mounted workspace inspection and alias mutation through the `workspace` namespace so root control stays schema-backed and consistent across CLI/API/help.

#### Scenario: Workspace list descriptor returns rich mounted-workspace metadata
- **WHEN** the AI runs `workspace list` through `root_bash`
- **THEN** the descriptor returns mounted workspace records including runtime-local id, alias, cwd, path, kind, and grants
- **AND** the direct `workspace_list` model tool may still expose only the minimal `{ id, cwd, alias }` projection

#### Scenario: Workspace alias mutation is descriptor-backed
- **WHEN** the AI runs `workspace set-alias` through `root_bash`
- **THEN** the runtime-local API route, CLI command, and help output are all derived from the same descriptor entry
- **AND** the runtime does not maintain a second handwritten alias parser

### Requirement: Runtime CLI help SHALL teach the new root shell names
Descriptor-backed runtime CLI help SHALL use `root_bash` as the canonical shell reference for runtime-local CLI commands.

#### Scenario: Descriptor help prefers root_bash command plus stdin examples
- **WHEN** the AI runs `message send --help` or `terminal write --help`
- **THEN** the help includes a preferred `root_bash.command + stdin` example
- **AND** it does not teach `root_workspace_bash` as the active shell name
