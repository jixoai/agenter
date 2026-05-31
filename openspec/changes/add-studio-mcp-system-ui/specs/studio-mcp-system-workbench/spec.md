## ADDED Requirements

### Requirement: Studio SHALL expose MCP as a primary workbench destination

Studio SHALL expose an app-shell navigation item named `MCP` that opens `/mcp` as an independent workbench destination. The MCP workbench SHALL consume runtime/client-sdk contracts and SHALL NOT import `app-server` or `mcp-system` implementation internals.

#### Scenario: MCP route is reachable from app shell
- **WHEN** the operator opens Studio navigation
- **THEN** the primary Systems navigation includes `MCP`
- **AND** activating it opens `/mcp`
- **AND** the active navigation state follows `/mcp` and nested MCP routes

#### Scenario: MCP route stays inside Studio app boundary
- **WHEN** reviewers inspect the MCP route and feature source
- **THEN** it imports MCP data through Studio app controller and client runtime-store facades
- **AND** it does not import `packages/app-server/src/mcp-system/*`, runtime internals, or cli-shell modules

### Requirement: MCP workbench SHALL be scoped by runtime authority

The MCP workbench SHALL make the selected AvatarRuntime authority explicit before reading or mutating MCP state. If no runtime is selected or available, the workbench SHALL render a stable empty state and SHALL NOT invent a local MCP registry.

#### Scenario: No runtime selected
- **WHEN** the operator opens `/mcp` without a selectable runtime authority
- **THEN** the workbench renders an explicit no-runtime state
- **AND** add, enable, lifecycle, and call actions are disabled
- **AND** no Studio-local MCP database is created

#### Scenario: Runtime selection controls MCP facts
- **WHEN** the operator selects runtime `runtime:a`
- **THEN** MCP list, query, lifecycle, and mutation actions target `runtime:a`
- **AND** switching to runtime `runtime:b` refreshes MCP projections from `runtime:b`
- **AND** rows from the previous runtime are not presented as current truth

### Requirement: MCP workbench SHALL use global plus exact-project projection

The MCP workbench SHALL show global MCP configs separately from exact-project enablement. A project path filter SHALL project installed globals for that exact path, including default-disabled rows, enabled rows, lifecycle state, project-local snapshots, and latest errors.

#### Scenario: Global-only list shows installed configs
- **WHEN** the operator opens `/mcp` without a project path filter
- **THEN** the list shows installed global MCP configs
- **AND** it does not imply any project is enabled
- **AND** it does not start any MCP server

#### Scenario: Project filter shows default-disabled globals
- **GIVEN** global MCP `fs` exists
- **AND** project `/repo/app` has not enabled `fs`
- **WHEN** the operator filters the workbench to exact project path `/repo/app`
- **THEN** the row for `fs` is visible as disabled by default
- **AND** lifecycle controls for `fs` are disabled until project enablement is explicit
- **AND** no live MCP session is started by viewing the row

#### Scenario: Project filter shows enabled project snapshot
- **GIVEN** global MCP `fs` is enabled for project `/repo/app`
- **AND** `fs` has a latest project-local snapshot for `/repo/app`
- **WHEN** the operator selects project path `/repo/app`
- **THEN** the row for `fs` shows enabled state, lifecycle state, and snapshot counts
- **AND** the detail pane shows tools, resources, prompts, server info, and snapshot time from `/repo/app`
- **AND** snapshots from other project paths are not shown as `/repo/app` truth

### Requirement: MCP detail pane SHALL expose safe global and project actions

The MCP detail pane SHALL expose global config summary/edit actions, exact-project enable/disable, project-scoped start/stop/restart, and blocked-remove confirmation while preserving existing MCP defaults.

#### Scenario: Global add remains inert
- **WHEN** the operator adds a global MCP config from the workbench
- **THEN** the global config is persisted through the runtime MCP facade
- **AND** no project is enabled
- **AND** no MCP server is started

#### Scenario: Enablement gates lifecycle controls
- **GIVEN** global MCP `fs` exists
- **AND** project `/repo/app` has not enabled `fs`
- **WHEN** the operator views `fs` under project `/repo/app`
- **THEN** start, stop, restart, and test-call controls are unavailable
- **AND** an explicit enable action is available

#### Scenario: Remove blocked by running project requires explicit stop confirmation
- **GIVEN** global MCP `fs` has a running instance in project `/repo/app`
- **WHEN** the operator removes global MCP `fs` without choosing to stop running instances
- **THEN** the workbench shows the blocked project path returned by the runtime
- **AND** the global config remains visible
- **AND** retrying with stop requires an explicit destructive confirmation

### Requirement: MCP workbench SHALL render capability snapshots and action outcomes as structured data

The MCP workbench SHALL render tool/resource/prompt snapshots, tool argument schemas, call results, latest errors, and action facts through reusable structured-data presentation components rather than raw unbounded text dumps.

#### Scenario: Snapshot detail uses structured presentation
- **WHEN** a project-local snapshot contains MCP tools, resources, prompts, schemas, or metadata
- **THEN** the detail pane renders the data in bounded structured sections
- **AND** long JSON values are scrollable or collapsible inside the detail surface
- **AND** the snapshot remains labeled with its exact project path and snapshot timestamp

#### Scenario: Tool test call keeps auto-enable explicit
- **GIVEN** global MCP `fs` is installed but disabled for project `/repo/app`
- **WHEN** the operator opens the test-call dialog for `fs`
- **THEN** the dialog does not default to `autoEnable: true`
- **AND** any auto-enable option is visibly explicit before submission

### Requirement: MCP workbench SHALL have responsive BDD coverage

The MCP workbench SHALL include BDD-style tests that cover app-shell navigation, runtime scoping, project projection, lifecycle gating, blocked removal, snapshot rendering, and responsive desktop/mobile layout behavior.

#### Scenario: Storybook DOM covers project projection states
- **WHEN** the MCP workbench Storybook DOM tests run
- **THEN** stories cover global-only, default-disabled project, enabled stopped project, running project, failed project, and blocked-remove states
- **AND** those stories assert visible behavior rather than private component state

#### Scenario: Route smoke covers desktop and mobile
- **WHEN** route-level MCP smoke acceptance runs
- **THEN** `/mcp` is reachable on desktop
- **AND** `/mcp` is reachable through the compact navigation path on the iPhone 14 viewport
- **AND** the main MCP list-detail workflow remains usable without overlapping controls
