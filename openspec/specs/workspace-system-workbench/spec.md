# workspace-system-workbench Specification

## Purpose
Define the durable global Workspace workbench shell, its `Explorer / Rules / Private` mode law, and the shared preview/search contracts that project WorkspaceSystem into WebUI.
## Requirements
### Requirement: Workspace workbench SHALL treat each workspace as one persistent single-root resource
The WebUI SHALL present each workspace as one persistent system resource comparable to MessageSystem rooms and TerminalSystem terminals. One workspace SHALL map to exactly one directory root. The global `Workspaces` destination SHALL first land on one fixed start page used to choose that root, and the workspace detail surface SHALL NOT imply that one page can swap between multiple unrelated roots inline.

#### Scenario: Land on the fixed workspace start page
- **WHEN** the user opens the global `Workspaces` destination itself
- **THEN** the workbench first renders a stable start page for choosing one workspace root
- **AND** choosing a root transitions into a dedicated single-root detail route instead of mutating the current detail body to another root

#### Scenario: Open one workspace root as a dedicated tab
- **WHEN** the user chooses a workspace root from the fixed start page
- **THEN** the workbench opens that root inside its own closable workspace tab, comparable to the room-tab pattern used by `Messages`
- **AND** the fixed start page remains available as its own stable tab instead of being replaced

#### Scenario: Open a workspace workbench entry
- **WHEN** the user opens a workspace from the global `Workspaces` destination
- **THEN** the page identifies one workspace resource and its one canonical root directory
- **AND** the shell does not show multi-root mount management inside that workspace detail

#### Scenario: Scan workspace persistence cues
- **WHEN** the user reads the workspace content header
- **THEN** the page can communicate that the workspace is a durable resource comparable to rooms and terminals
- **AND** the persistence cue does not replace the actual root path identity

### Requirement: Workspace modes SHALL share one content header with `View as` avatar switching and root-path context
The `Explorer`, `Rules`, and `Private` workspace modes SHALL reuse one shared `page-content` header that exposes a `View as` avatar switcher plus the current workspace root path. The `View as` control SHALL show avatar identity with both icon/avatar mark and nickname. That header SHALL preserve these facts while staying density-aware across desktop and compact viewports, and SHALL NOT expand into a detached oversized hero card.

#### Scenario: Switch workspace mode without losing shared header context
- **WHEN** the user switches between `Explorer`, `Rules`, and `Private`
- **THEN** the content header still shows the same `View as` avatar control and workspace root path
- **THEN** mode changes do not create three unrelated page-header patterns

#### Scenario: Change the `View as` avatar
- **WHEN** the user opens the `View as` dropdown and selects another avatar
- **THEN** the workbench updates the visible workspace lens to that avatar
- **THEN** the header continues to show the avatar icon/avatar mark plus nickname for the active lens

#### Scenario: Compact header keeps one concise workspace identity
- **WHEN** the workspace content header renders on a compact viewport
- **THEN** it keeps one concise workspace identity label visible alongside the active `View as` control
- **THEN** the full workspace path remains available through the same header affordance instead of forcing a second expanded title block

#### Scenario: Desktop header stays integrated with the workbench body
- **WHEN** the workspace content header renders on a desktop-sized viewport
- **THEN** it still reads as one integrated workbench content surface rather than a detached oversized card
- **THEN** extra whitespace or framing does not outweigh the actual workspace facts it is meant to convey

#### Scenario: Shared workspace content surfaces avoid fake nested cards
- **WHEN** the operator reads the shared workspace header, rule catalog, or preview drawer inside `page-content`
- **THEN** those content areas only keep borders, rounding, or gradients when they mark a true semantic surface such as media clipping or explicit notice state
- **THEN** route-local content does not stack extra card framing on top of the workbench shell without new meaning

### Requirement: Workspace detail SHALL expose a management dialog for Avatar mounts
The workspace detail surface SHALL expose a dedicated management dialog for the current workspace root. The dialog SHALL manage Avatar mount / unmount state for that workspace instead of pushing this workflow into Avatar detail.

#### Scenario: Open workspace management from workspace detail
- **WHEN** the operator opens the management action from one workspace detail route
- **THEN** the workbench presents a dedicated management dialog for that workspace root
- **AND** the operator does not need to leave `/workspaces` or navigate into Avatar detail to manage mounts

#### Scenario: Mount one avatar to the current workspace
- **WHEN** the operator selects an avatar that is not yet mounted to the current workspace and confirms the action
- **THEN** the workspace is mounted for that avatar
- **AND** the dialog updates to show that avatar as mounted

#### Scenario: Unmount one avatar from the current workspace
- **WHEN** the operator selects a mounted avatar and confirms unmount
- **THEN** the workspace detaches from that avatar's runtime
- **AND** the dialog updates to show that avatar as no longer mounted

### Requirement: Workspace workbench SHALL preserve the same capability path across desktop and compact breakpoints
Responsive adaptation SHALL preserve the same workspace capabilities even when the geometry changes. `Tablet landscape` MAY keep a visible sidebar and persistent detail drawer longer, while `tablet portrait` and `phone` MAY collapse sidebar navigation into a compact shell and stack the detail surface as a sheet below the bottom area.

#### Scenario: Use tablet landscape
- **WHEN** the user opens the workspace workbench on a landscape tablet viewport
- **THEN** the layout can keep the visible left sidebar and persistent detail drawer if space allows
- **AND** the user still reaches the same `Explorer / Rules / Private` modes and shared content header

#### Scenario: Use tablet portrait or phone
- **WHEN** the user opens the workspace workbench on a portrait tablet or phone viewport
- **THEN** left navigation can collapse into a compact shell or drawer trigger
- **AND** the detail surface can stack below the bottom area as a sheet instead of staying a persistent side column
- **AND** the same mode switching, content header, and page actions remain reachable

### Requirement: Workspace management dialog SHALL stay workspace-centric while coexisting with Explorer, Rules, and Private
The management dialog SHALL treat the current workspace root as the fixed subject and SHALL present Avatar mount state, runtime state, and rule entry points around that one workspace. Explorer, Rules, and Private remain file workflows, not the primary mount-management shell.

#### Scenario: Rules remain the file-permission work surface after management changes
- **WHEN** the operator mounts or unmounts avatars through the management dialog
- **THEN** the main workbench still returns to Explorer, Rules, or Private for file work
- **AND** the dialog does not replace Rules as the primary file-permission editing surface

#### Scenario: Workspace management shows avatar state from the workspace point of view
- **WHEN** the operator scans the dialog list
- **THEN** each row is organized around one avatar's relationship to the current workspace
- **AND** the dialog does not impersonate a global avatar runtime dashboard

### Requirement: Explorer mode SHALL use one tree surface plus quick-rule editing
`Explorer` mode SHALL keep the main surface as one tree-first explorer instead of a nested master-detail split inside `main-area`. The `right-drawer` SHALL own preview or inspection, and the `bottom-area` SHALL act only as a quick-rule editor for the currently selected path.

#### Scenario: Browse the workspace tree in Explorer mode
- **WHEN** the user enters `Explorer`
- **THEN** `main-area` shows one expandable tree surface for the workspace root and its descendants
- **AND** path-level effective access is visible inline on the relevant rows

#### Scenario: Edit only the selected path from Explorer bottom area
- **WHEN** the user selects a file or directory while in `Explorer`
- **THEN** the `bottom-area` shows quick actions for that selected path only
- **AND** the full rule catalog remains a separate `Rules` mode instead of being embedded under the tree

### Requirement: Workspace trees SHALL support disclosure, virtualization, and bounded initial directory reads
Workspace tree surfaces SHALL support click-driven expand/collapse behavior for folders. Large directories SHALL render through tree virtualization, SHALL show only the first 1000 children initially, and SHALL expose an explicit `Load more` affordance for the remaining entries.

#### Scenario: Expand or collapse a folder row
- **WHEN** the user activates a folder row in a workspace tree
- **THEN** that folder toggles between expanded and collapsed state
- **AND** the workbench does not require a route change to inspect descendants

#### Scenario: Open a directory with more than 1000 children
- **WHEN** the selected directory contains more than 1000 direct children
- **THEN** the tree renders only the first 1000 entries initially
- **AND** the UI shows a `Load more` row or equivalent affordance for the remaining children while keeping the tree virtualized

### Requirement: Rules mode SHALL expose the full rule catalog and selected-rule editing
`Rules` mode SHALL show the configured workspace rule catalog for the active avatar lens while keeping the model KISS-first. The `main-area` SHALL support browsing the catalog, and the `bottom-area` SHALL edit the currently selected rule, including add, duplicate, delete, and apply actions.

#### Scenario: Inspect the full rule catalog
- **WHEN** the user switches to `Rules`
- **THEN** `main-area` lists workspace rules across paths instead of rendering the explorer tree
- **AND** the rule list distinguishes at least path, access, enabled state, and ordering priority
- **AND** the rule list does not require `kind` or `source` columns in the first shipping surface

#### Scenario: Load the full configured rule set
- **WHEN** the user opens `Rules`
- **THEN** the page can render the full configured rule catalog by default
- **AND** the page does not depend on a small `Load more rules` row to reach the normal working set
- **AND** any future pagination or chunking remains a fallback for genuinely oversized catalogs rather than the default experience

#### Scenario: Edit one selected rule
- **WHEN** the user selects one rule in `Rules`
- **THEN** the `bottom-area` exposes that rule's editable access and action controls
- **AND** destructive actions such as delete operate on the selected rule rather than the currently opened file preview

#### Scenario: Toggle or reorder rules inline
- **WHEN** the user scans or manipulates rule rows in `Rules`
- **THEN** each row can expose inline enable/disable state plus a reorder affordance
- **AND** those controls do not require opening a secondary inspector just to confirm the rule is active or reprioritized

### Requirement: Rules right drawer SHALL stay informational instead of acting as a rule inspector
`Rules` SHALL NOT depend on the `right-drawer` for selected-rule inspection. The drawer MAY stay collapsed or informational, but the user SHALL be able to understand and edit the selected rule from the catalog plus bottom editor alone.

#### Scenario: Work in Rules mode without opening an inspector
- **WHEN** the user edits rules in `Rules`
- **THEN** the essential rule controls remain in the list and `bottom-area`
- **AND** the page does not force the user into a rule-specific inspector drawer to complete normal editing flows

### Requirement: Private mode SHALL browse avatar-private assets without permission chrome
`Private` mode SHALL present the avatar-private workspace asset tree using the same tree mental model as `Explorer`, but it SHALL omit permission badges because the private lens already implies authority. Its `bottom-area` SHALL expose private-asset creation or organization actions rather than rule management.

#### Scenario: Browse private assets
- **WHEN** the user switches to `Private`
- **THEN** `main-area` shows the avatar-private folders and files for the active `View as` avatar
- **AND** the rows do not display read/write permission badges

#### Scenario: Use bottom actions in Private mode
- **WHEN** the user selects a private asset in `Private`
- **THEN** the `bottom-area` offers private-asset actions such as create, reveal, or archive
- **AND** the area does not expose shared workspace rule editing controls

### Requirement: Private preview metadata SHALL stay at the drawer bottom with light separation
In `Private` mode, the `right-drawer` SHALL keep the content preview dominant and SHALL place metadata at the bottom of the drawer using light separation such as spacing or a simple divider. The drawer SHALL NOT wrap every metadata block in additional bordered cards by default.

#### Scenario: Inspect private asset metadata
- **WHEN** the user previews a private asset in the drawer
- **THEN** the preview content remains the dominant surface
- **AND** metadata stays docked near the bottom of the drawer with light separation rather than a stack of bordered cards

### Requirement: Explorer and Private drawers SHALL share one typed preview contract
`Explorer` and `Private` SHALL share the same typed preview contract in the `right-drawer`. Text files default to a CodeMirror-like reading surface, image/audio/video use lightweight media preview, and unsupported files enter an explicit `No preview` state.

#### Scenario: Preview a text file
- **WHEN** the selected item is a text-like file
- **THEN** the drawer renders a CodeMirror-like text reading surface
- **AND** metadata remains secondary below the preview

#### Scenario: Preview media or unsupported content
- **WHEN** the selected item is an image, audio, or video file
- **THEN** the drawer renders a lightweight media preview surface
- **AND** unsupported content types explicitly render a `No preview` state instead of leaving the drawer blank

### Requirement: Workspace modes SHALL provide inline page search from the toolbar
`Explorer`, `Rules`, and `Private` SHALL provide page-level search from a toolbar search action. Activating search SHALL expand a compact find control in place near the toolbar icon and SHALL expose query input, match count, previous, next, and cancel actions. Highlighting SHALL target the current page content rather than acting only as a separate filter list.

#### Scenario: Open page search from the toolbar
- **WHEN** the user activates the toolbar search action in any workspace mode
- **THEN** the toolbar expands a compact find control near the search icon
- **AND** the control shows query input, match count, `prev`, `next`, and `cancel`

#### Scenario: Jump through highlighted matches
- **WHEN** the user searches for a term in a workspace mode
- **THEN** matching content in the current page is visibly highlighted
- **AND** the user can jump to the previous or next active match without leaving the current mode

### Requirement: Workspace toolbar actions SHALL remain mode-specific
Workspace toolbar actions SHALL be chosen per mode instead of forcing one fixed action set across `Explorer`, `Rules`, and `Private`. `Explorer` and `Private` MAY expose preview/inspector toggles, while `Rules` SHALL NOT depend on preview actions.

#### Scenario: Compare toolbar actions across modes
- **WHEN** the user switches between `Explorer`, `Rules`, and `Private`
- **THEN** the toolbar action set changes to match the current mode
- **AND** `Rules` does not display preview-dependent actions that have no meaning in the rule catalog

### Requirement: Workspace view hints SHALL stay factual and surface-local
Workspace help hints SHALL describe the actual interaction law of the current surface instead of generic onboarding copy. Explorer tree, Rules, Private, Rules summary, and media preview surfaces SHALL keep factual copy that matches their real behavior.

#### Scenario: Inspect surface-local help hints
- **WHEN** the operator opens workspace tree, rules, or preview surfaces
- **THEN** the hints describe concrete facts such as disclosure, virtualization, full-catalog loading, private-asset scope, inspector absence, and no-preview fallback
- **AND** the hints do not drift into generic or contradictory copy

### Requirement: Workspace explorer data loading SHALL be path-scoped and bounded
The Workspace Explorer SHALL load data per-path via an explicit interface rather than fetching the entire tree globally. Requests SHALL specify the target `path` and an optional `deep` integer defaulting to `1`, and the backend SHALL enforce a maximum return limit of `100` items per directory level per request. When a folder exceeds that limit, the UI SHALL render an inline `Load N remaining items...` virtual node as the last logical child inside that folder instead of a global footer.

#### Scenario: Load a bounded directory branch
- **WHEN** the operator expands a large directory branch
- **THEN** the request targets that path rather than the whole workspace tree
- **AND** the branch returns at most `100` children for that level
- **AND** any remaining children appear behind an inline virtual `Load more` row inside the same folder boundary

### Requirement: Explorer search SHALL reuse the tree model as a recursive path filter
Search within the Explorer SHALL behave as a glob or gitignore-style pattern matcher applied recursively over workspace paths. Search results SHALL be rendered using the same hierarchical tree component used for standard browsing, acting as a filter mask instead of a disconnected flat list.

#### Scenario: Search Explorer without abandoning tree context
- **WHEN** the operator searches inside Explorer
- **THEN** the same tree component renders the matching result set
- **AND** non-matching branches can collapse away without replacing the tree with a detached flat-list result mode

### Requirement: FileViewer SHALL render previews through an isolated iframe host
The `FileViewer` component SHALL be the universal viewport for file previews including text, HTML, video, image, and audio. It SHALL render content inside an isolated `<iframe>` pointing at `/fileviewer`, SHALL support `?path=<encoded_path>` plus optional `&mime=<mime_type>` routing, SHALL expose a universal floating fullscreen action from the host, and SHALL use strict sandbox attributes to keep untrusted preview content isolated from the host shell.

#### Scenario: Open a file preview inside FileViewer
- **WHEN** the operator previews a file through the workspace drawer
- **THEN** the host routes that preview through the isolated `/fileviewer` iframe contract
- **AND** the host still provides one consistent fullscreen affordance without depending on file-type-specific preview chrome
- **AND** sandboxing prevents the preview content from escaping into the host shell

### Requirement: FileViewer SHALL default renderable text files to source mode and guard HTML preview
For text-based files that support rendering such as `.md`, `.svg`, and `.html`, `FileViewer` SHALL provide a `Preview / Source` toggle and SHALL default to `Source` mode to preserve developer visibility. Attempting to preview `.html` SHALL require an explicit security confirmation before the iframe render starts.

#### Scenario: Switch a renderable text file between source and preview
- **WHEN** the operator opens a renderable text-like file
- **THEN** the file starts in `Source` mode
- **AND** the viewer can switch to `Preview` without changing the outer drawer contract

#### Scenario: Confirm HTML preview before rendering
- **WHEN** the operator attempts to preview an `.html` file
- **THEN** the viewer presents a security warning before launching the preview iframe
- **AND** the actual HTML render only begins after explicit confirmation

### Requirement: Workspace start page SHALL prioritize workspace scanning before secondary summary
The fixed `Workspaces` start page SHALL behave as a list-first chooser. The root list SHALL remain the dominant first-screen surface, while the secondary detail panel SHALL stay factual and brief instead of consuming equal visual weight through low-signal framing.

#### Scenario: Mobile start page keeps multiple roots visible before entry
- **WHEN** the operator opens `Workspaces` on an iPhone 14-sized viewport
- **THEN** the first screen still shows multiple workspace roots as immediately tappable rows
- **THEN** the route does not spend the majority of its visible height on a detached summary panel before root scanning begins

#### Scenario: Start-page detail summary stays factual
- **WHEN** the operator selects one workspace root on the start page without entering it yet
- **THEN** the secondary detail surface only shows short factual identity and entry summary for that root
- **THEN** the route does not expand that summary into a low-value showcase card that competes with the chooser list

### Requirement: Compact workspace stages SHALL preserve primary viewport budget
On compact workspace viewports, the shared content header, main stage, bottom-area, and right detail SHALL preserve the primary tree or rule-catalog viewport as the dominant task surface. Supporting chrome SHALL compress before the primary stage loses its working height.

#### Scenario: Compact explorer keeps the tree as the dominant surface
- **WHEN** the operator opens a workspace detail route on a compact viewport
- **THEN** the shared content header and bottom-area compress enough that the explorer tree still owns the main visible viewport budget
- **THEN** supporting surfaces do not consume more visual height than the current tree selection workflow

#### Scenario: Compact bottom-area becomes a dense support dock
- **WHEN** the operator is in `Explorer`, `Rules`, or `Private` on a compact viewport
- **THEN** the bottom-area keeps the same actions reachable through a denser dock-like presentation
- **THEN** the route does not re-expand those actions into a second tall card that pushes the primary stage off screen

### Requirement: Workspace detail surfaces SHALL consume the shared split-detail layout law
Workspace routes that pair a primary left work surface with auxiliary right detail SHALL consume the shared split-detail layout law. Desktop workspace detail SHALL reuse the persisted ratio and resize handle, while compact workspace detail SHALL collapse through the shared right-sheet path without changing the available workspace capabilities.

#### Scenario: Desktop workspace detail uses the shared ratio-driven split
- **WHEN** the operator opens a workspace route on a container wide enough for persistent split detail
- **THEN** the route renders its left work surface and right auxiliary detail through the shared split-detail layout
- **THEN** the right detail width follows the shared ratio and clamp law instead of a route-local fixed drawer width

#### Scenario: Compact workspace detail preserves the same capabilities
- **WHEN** the workspace route no longer has enough width to satisfy the shared split minimums
- **THEN** the right auxiliary detail collapses into the shared compact right-sheet path
- **THEN** the operator still reaches the same mode switching, preview, and supporting detail capabilities without a separate route

### Requirement: Workspace toolbar SHALL remain view-centric while bottom-area owns functional editing
Workspace toolbar chrome SHALL stay responsible for page identity, mode switching, search, and other view-level controls. Functional editing actions for the current workspace task SHALL remain in the left-side page content, primarily its `bottom-area`, even when compact right detail is open.

#### Scenario: Rules editing stays in the bottom-area
- **WHEN** the operator edits workspace rules while the route exposes auxiliary right detail
- **THEN** add, duplicate, delete, and apply actions remain in the `bottom-area`
- **THEN** opening or closing right detail does not move those rule-editing actions into the toolbar

#### Scenario: Explorer and Private keep toolbar focused on view switching
- **WHEN** the operator switches between `Explorer`, `Rules`, and `Private` while a workspace detail surface is available
- **THEN** the toolbar continues to express mode/view controls rather than detail-local task actions
- **THEN** compact right-detail takeover only replaces the toolbar with a close affordance for the open view, not with a new action bar

### Requirement: Workspace workbench SHALL distinguish `root-workspace` and `public-workspace` semantics
The workspace workbench SHALL make the semantic difference between `root-workspace` and `public-workspace` visible in the page chrome. That distinction SHALL explain env/CLI behavior rather than implying that root-workspace is categorically unshareable. The UI SHALL keep the current workspace root identity explicit while also teaching whether the surface carries root-exclusive env/CLI or collaboration-oriented public-workspace semantics.

#### Scenario: Root-workspace page identifies the fixed root surface
- **WHEN** the operator opens a root-workspace entry in the workbench
- **THEN** the page identifies it as the fixed root-workspace surface
- **AND** the page communicates that root-exclusive env/CLI semantics live there

#### Scenario: Public-workspace page identifies the collaboration surface
- **WHEN** the operator opens an ordinary mounted workspace entry in the workbench
- **THEN** the page identifies it as a public-workspace collaboration surface
- **AND** the page does not imply that root-exclusive env/CLI helpers are available there

#### Scenario: Root-workspace distinction does not claim an ownership ban
- **WHEN** the operator reads the root/public workspace distinction in the workbench
- **THEN** the explanatory copy frames the difference as env/CLI semantics
- **AND** the page does not claim that root-workspace can never be shared or visited

