# skills-workbench Specification

## Purpose

Define the Skills primary workbench, including its fixed catalog tab, avatar skill overview and dedicated tabs, and the universal iframe-based file preview contract.

## Requirements

### Requirement: Skills SHALL be a primary workbench with one fixed catalog tab

The WebUI SHALL expose `Skills` as a primary workbench destination. The workbench SHALL keep one fixed catalog tab selected by the route, and that tab's `page-toolbar` SHALL expose `SKILLS_HOME`, `built-in`, and `avatars` as `page-tabs`.

#### Scenario: Skills route opens on the fixed catalog tab
- **WHEN** the operator opens `/skills`
- **THEN** the shared workbench chrome renders one fixed Skills catalog tab
- **AND** the route lands on the default `skills-home` page-tab unless a different catalog view is encoded in the route

#### Scenario: Legacy catalog links canonicalize to current tabs
- **WHEN** the operator opens `/skills?view=shared`, `/skills?view=global`, or `/skills?view=avatar`
- **THEN** `shared` and `global` canonicalize to `skills-home`
- **AND** `avatar` canonicalizes to `avatars` without duplicating the old key in state

#### Scenario: Page-tabs stay inside the shared toolbar law
- **WHEN** the operator switches between `skills-home`, `built-in`, and `avatars`
- **THEN** the switch happens inside the shared `page-toolbar` page-tabs region
- **AND** the route does not render a second detached local header for those modes

### Requirement: Built-in and SKILLS_HOME catalogs SHALL use accordion list-detail browsing

The `built-in` and `skills-home` page-tabs SHALL render one accordion item per skill. Expanding an item SHALL reveal a real file tree for that skill root, and selecting a file SHALL open the shared detail preview without leaving the current page-tab. `skills-home` rows SHALL show the source env/path that produced the visible skill.

#### Scenario: Skill accordion expands into a file tree
- **WHEN** the operator expands one skill row inside `built-in` or `skills-home`
- **THEN** the route reveals that skill root's file tree inside the same list surface
- **AND** collapsing the accordion hides the tree without losing the surrounding catalog state

#### Scenario: File selection opens the shared detail preview
- **WHEN** the operator selects a file from one expanded skill tree
- **THEN** the shared detail surface shows that file's preview and metadata
- **AND** compact layouts reuse the existing compact detail drawer law instead of inventing a second preview shell

### Requirement: Avatars page-tab SHALL be an avatar overview with workspace-grouped skill preview

The `avatars` page-tab SHALL list all visible avatars first. Selecting one avatar SHALL open a preview-oriented detail surface that summarizes that avatar's workspace-grouped avatar-private skill roots, keeping `Root workspace` first and showing only non-root workspaces that contain avatar-private skills.

#### Scenario: Avatar overview previews grouped workspace skills
- **WHEN** the operator selects one avatar inside the `avatars` page-tab
- **THEN** the detail surface shows `Root workspace` first and any additional workspace groups with avatar-private skills after it
- **AND** the overview stays avatar-list-first rather than opening a full file browser immediately

#### Scenario: Avatar overview omits empty workspace groups
- **WHEN** an avatar has no avatar-private skills in one mounted workspace
- **THEN** that workspace does not appear in the overview group list
- **AND** the overview still keeps `Root workspace` visible

### Requirement: Opening an avatar SHALL create a dedicated avatar skill tab

From the `avatars` overview, the operator SHALL be able to open one dedicated avatar skill tab keyed by avatar nickname. That dedicated tab SHALL browse the selected avatar's skills by workspace group using the same file tree and detail preview law as the catalog page, while staying a normal closable workbench tab.

#### Scenario: Avatar tab opens as a new workbench tab
- **WHEN** the operator opens avatar `default` from the `avatars` overview
- **THEN** the Skills workbench adds one dedicated `default` tab beside the fixed catalog tab
- **AND** the tab body renders the workspace-grouped avatar skill browser for that avatar

#### Scenario: Closing avatar tab only removes local workbench presence
- **WHEN** the operator closes a dedicated avatar skill tab
- **THEN** the current device removes only that workbench tab projection
- **AND** the avatar, its skill roots, and the fixed catalog tab remain durable and reopenable

### Requirement: All file previews SHALL use one isolated filePreviewer entry

The Skills workbench SHALL route every selected file preview through one isolated `filePreviewer` entry embedded by iframe. `filePreviewer` SHALL choose the concrete renderer by preview kind, including CodeMirror-based source rendering for text-like files and mature library renderers for pdf/media.

#### Scenario: Text preview uses filePreviewer with CodeMirror
- **WHEN** the operator selects `SKILL.md`, `ccski.config.json`, or another text-like file
- **THEN** the detail surface embeds `filePreviewer` for that file
- **AND** the preview shell renders the original source through a CodeMirror-based read-only renderer

#### Scenario: Pdf and media preview load through the same isolated preview entry
- **WHEN** the operator selects a file classified as `pdf`, `image`, `audio`, or `video`
- **THEN** the detail surface embeds the isolated `filePreviewer` entry for that file
- **AND** the main workbench route keeps preview dependency and cleanup ownership outside its own component tree
- **AND** the preview shell swaps only its internal renderer instead of changing outer preview ownership
