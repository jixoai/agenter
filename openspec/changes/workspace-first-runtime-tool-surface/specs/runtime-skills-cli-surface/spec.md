# runtime-skills-cli-surface Specification

## MODIFIED Requirements

### Requirement: Runtime SHALL expose a minimal workspace-aware direct tool surface
Each AI model round SHALL receive exactly three direct shell/workspace tools: `workspace_list`, `root_bash`, and `workspace_bash`. Runtime control systems such as `attention`, `message`, `workspace`, `terminal`, and `skill` SHALL remain reachable through the root shell only.

#### Scenario: Model receives only the three direct tools
- **WHEN** the runtime prepares a model call
- **THEN** the direct tool list contains `workspace_list`, `root_bash`, and `workspace_bash`
- **AND** it does not contain `root_workspace_list`, `root_workspace_bash`, or direct `attention_*` / `message_*` / `terminal_*` tools

#### Scenario: Mounted workspace discovery stays minimal
- **WHEN** the AI calls `workspace_list`
- **THEN** the runtime returns `Array<{ id:number, cwd:string, alias:string }>`
- **AND** the list includes only mounted project workspaces, not the avatar root workspace

### Requirement: Root shell SHALL remain the only direct system-control shell
The shell environment behind `root_bash` SHALL provide the runtime-local CLI commands for `attention`, `message`, `workspace`, `terminal`, `skill`, and `tool`. Mounted project workspace shells SHALL NOT implicitly gain that same control plane.

#### Scenario: Root shell exposes runtime-local CLI commands
- **WHEN** the AI runs `which attention`, `which workspace`, or `which skill` inside `root_bash`
- **THEN** each command is discoverable and executable from that shell session

#### Scenario: Project workspace shell does not inherit root control commands
- **WHEN** the AI calls `workspace_bash` for a mounted project workspace
- **THEN** that shell only exposes the workspace’s own filesystem authority and workspace tool scripts
- **AND** it does not receive injected root-only runtime CLI commands or root credentials

### Requirement: Runtime guidance SHALL teach root control and workspace execution separately
Built-in runtime skills, references, and top-level runtime prompts SHALL teach `workspace_list` for discovery, `root_bash` for runtime control, and `workspace_bash` for pure workspace file/command work.

#### Scenario: Built-in runtime guidance stops teaching legacy root_workspace names
- **WHEN** the runtime renders built-in guidance for `agenter-runtime`, `agenter-message`, or `agenter-terminal`
- **THEN** the guidance references `workspace_list`, `root_bash`, and `workspace_bash`
- **AND** it does not reference `root_workspace_list` or `root_workspace_bash`
