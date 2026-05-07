## MODIFIED Requirements

### Requirement: Workspace modes SHALL share one toolbar-controlled `View as` lens plus one factual content header
The `Explorer`, `Rules`, `Private`, and `CLI` workspace modes SHALL reuse one shared `page-toolbar` `View as` avatar switcher plus one shared `page-content` header for workspace root and surface facts. The `View as` control SHALL show avatar identity with both icon/avatar mark and nickname. The content header SHALL preserve workspace root and surface facts while staying density-aware across desktop and compact viewports, and SHALL NOT expand into a detached oversized hero card.

#### Scenario: Switch workspace mode without losing shared header context
- **WHEN** the user switches between `Explorer`, `Rules`, `Private`, and `CLI`
- **THEN** the shared toolbar still shows the same `View as` avatar control
- **AND** the content header still shows the same workspace root and surface facts
- **AND** mode changes do not create four unrelated page-header patterns

#### Scenario: Change the `View as` avatar
- **WHEN** the user opens the `View as` dropdown and selects another avatar
- **THEN** the workbench updates the visible workspace lens to that avatar
- **AND** the shared toolbar continues to show the avatar icon/avatar mark plus nickname for the active lens

#### Scenario: Compact header keeps one concise workspace identity
- **WHEN** the workspace content header renders on a compact viewport
- **THEN** it keeps one concise workspace identity label visible without reintroducing a second avatar picker
- **AND** the full workspace path remains available through the same header affordance instead of forcing a second expanded title block

#### Scenario: Desktop header stays integrated with the workbench body
- **WHEN** the workspace content header renders on a desktop-sized viewport
- **THEN** it still reads as one integrated workbench content surface rather than a detached oversized card
- **AND** extra whitespace or framing does not outweigh the actual workspace facts it is meant to convey

#### Scenario: Shared workspace content surfaces avoid fake nested cards
- **WHEN** the operator reads the shared workspace header, rule catalog, CLI catalog, or preview drawer inside `page-content`
- **THEN** those content areas only keep borders, rounding, or gradients when they mark a true semantic surface such as media clipping or explicit notice state
- **THEN** route-local content does not stack extra card framing on top of the workbench shell without new meaning

### Requirement: Workspace workbench SHALL preserve the same capability path across desktop and compact breakpoints
Responsive adaptation SHALL preserve the same workspace capabilities even when the geometry changes. `Tablet landscape` MAY keep a visible sidebar and persistent detail drawer longer, while `tablet portrait` and `phone` MAY collapse sidebar navigation into a compact shell and stack the detail surface as a sheet below the bottom area.

#### Scenario: Use tablet landscape
- **WHEN** the user opens the workspace workbench on a landscape tablet viewport
- **THEN** the layout can keep the visible left sidebar and persistent detail drawer if space allows
- **AND** the user still reaches the same `Explorer / Rules / Private / CLI` modes and shared content header

#### Scenario: Use tablet portrait or phone
- **WHEN** the user opens the workspace workbench on a portrait tablet or phone viewport
- **THEN** left navigation can collapse into a compact shell or drawer trigger
- **AND** the detail surface can stack below the bottom area as a sheet instead of staying a persistent side column
- **AND** the same mode switching, content header, and page actions remain reachable

### Requirement: Workspace toolbar actions SHALL remain mode-specific
Workspace toolbar actions SHALL be chosen per mode instead of forcing one fixed action set across `Explorer`, `Rules`, `Private`, and `CLI`. `Explorer` and `Private` MAY expose preview/inspector toggles, `Rules` SHALL NOT depend on preview actions, and `CLI` SHALL center search and command discovery instead of file-preview controls.

#### Scenario: Compare toolbar actions across modes
- **WHEN** the user switches between `Explorer`, `Rules`, `Private`, and `CLI`
- **THEN** the toolbar action set changes to match the current mode
- **AND** `Rules` does not display preview-dependent actions that have no meaning in the rule catalog
- **AND** `CLI` does not display file-preview controls that have no meaning in the command catalog

### Requirement: Workspace CLI mode SHALL render the grouped command catalog as a first-class workspace surface
`CLI` mode SHALL present the current workspace/avatar command catalog using grouped sections, route-local search, and the same shared workbench content law as other workspace modes.

#### Scenario: CLI mode renders grouped command sections
- **WHEN** the operator enters `CLI`
- **THEN** the main surface renders grouped sections for at least `just-bash builtins`, `root runtime CLI`, `workspace public tools`, and `workspace private tools` when those groups have entries
- **AND** the surface does not require the operator to infer command availability from unrelated file trees or raw shell probes

#### Scenario: CLI mode search filters command rows across groups
- **WHEN** the operator searches inside `CLI`
- **THEN** the current command catalog filters by command label, display name, and description
- **AND** the same search stays inside the workspace mode toolbar instead of opening a second detached search panel
