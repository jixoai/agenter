## ADDED Requirements

### Requirement: Custom terminal panes SHALL use one lower interaction owner

Shell-next custom terminal panes SHALL treat terminal-specific input and selection behavior as backend/kernel-owned truth. The Shell/OpenCompose view path SHALL NOT remain the durable owner of terminal selection or semantic selection state.

#### Scenario: Shell view forwards raw selection intent only

- **WHEN** a user presses, drags, or releases over a custom terminal pane
- **THEN** the Shell/OpenCompose terminal view translates raw host coordinates into terminal intent
- **AND** durable selection state is owned by the shell-next terminal interaction kernel / backend path
- **AND** the view layer remains only an input adapter and visual projector

#### Scenario: Semantic word selection remains backend-owned through mouseup

- **GIVEN** a custom terminal pane backend/kernel accepts a double-click word selection
- **WHEN** the click sequence completes
- **THEN** shell-next does not re-clear that selection from the Shell/OpenCompose view layer
- **AND** the backend-owned selection remains visible

#### Scenario: Semantic line selection remains backend-owned through mouseup

- **GIVEN** a custom terminal pane backend/kernel accepts a triple-click line selection
- **WHEN** the click sequence completes
- **THEN** shell-next does not re-clear that selection from the Shell/OpenCompose view layer
- **AND** the backend-owned selection remains visible

### Requirement: OpenCompose SHALL stay generic and terminal-agnostic

OpenCompose and pane composition laws SHALL remain generic. They SHALL own pane layout, pane chrome, hit testing, resize, focus, and source-family mounting. They SHALL NOT define terminal/editor-specific semantic mouse selection as a default pane law.

#### Scenario: Generic renderer content has no implicit semantic selection

- **WHEN** a renderer pane mounts arbitrary content such as a game or custom surface
- **THEN** generic pane composition does not automatically add double-click word selection
- **AND** generic pane composition does not automatically add triple-click line selection

#### Scenario: OpenCompose API surface stays content-family neutral

- **WHEN** shell-next implements terminal interaction behavior
- **THEN** OpenCompose APIs do not grow terminal-specific methods solely to support that behavior
- **AND** terminal-specific laws stay inside shell-next internal modules

### Requirement: Renderer semantic selection SHALL be opt-in

`cliRenderer`-family panes MAY opt into semantic mouse selection behavior, but that behavior SHALL be an explicit extension/plugin contract rather than a default pane/runtime law.

#### Scenario: Chat or Room renderer explicitly opts in

- **WHEN** a Chat or Room renderer pane installs the renderer selection plugin
- **THEN** double-click word selection and triple-click line selection are available for that renderer content
- **AND** the behavior is owned by the renderer-side extension path rather than generic pane composition

#### Scenario: Renderer pane without plugin stays neutral

- **WHEN** a renderer pane does not install the renderer selection plugin
- **THEN** shell-next does not assume semantic double/triple-click selection for that pane

### Requirement: Single-layer-first collapse SHALL precede special patches

When shell-next reworks terminal interaction ownership, it SHALL first collapse default behavior to the lower interaction owner. Any surviving higher-layer patch SHALL be treated as an explicit exception rather than the default architecture.

#### Scenario: Collapse precedes exception

- **WHEN** shell-next fixes a custom terminal pane selection/input bug
- **THEN** the default implementation path first removes higher-layer ownership
- **AND** any remaining higher-layer workaround is introduced only as a named special case with explicit justification
