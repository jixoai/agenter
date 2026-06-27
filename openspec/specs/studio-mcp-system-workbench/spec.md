# studio-mcp-system-workbench Specification

## Purpose

Define Studio's MCP workbench as a low-noise operator surface over Avatar-owned MCP truth, keeping config truth, Avatar ownership projection, project instance lifecycle, and probe inspection distinct.

## Requirements

### Requirement: Studio SHALL expose MCP as a primary workbench destination

Studio SHALL expose an app-shell navigation item named `MCP` that opens `/mcp` as an independent workbench destination. The MCP workbench SHALL consume Avatar-owned client-sdk contracts and SHALL NOT import `app-server` or `mcp-system` implementation internals.

#### Scenario: MCP route is reachable from app shell

- **WHEN** the operator opens Studio navigation
- **THEN** the primary Systems navigation includes `MCP`
- **AND** activating it opens `/mcp`
- **AND** the active navigation state follows `/mcp` and nested MCP routes

#### Scenario: MCP route stays inside Studio app boundary

- **WHEN** reviewers inspect the MCP route and feature source
- **THEN** it imports MCP data through Studio app controller and client runtime-store facades
- **AND** it does not import `packages/app-server/src/mcp-system/*`, runtime internals, or cli-shell modules

### Requirement: MCP workbench SHALL be scoped by Avatar authority

The MCP workbench SHALL keep MCP truth Avatar-owned without depending on a running AvatarRuntime. Config mutation SHALL target the owner Avatar chosen in config detail, and Avatar inspection SHALL stay inside the read-only `Avatars` projection. Studio SHALL NOT invent a local MCP registry.

#### Scenario: No running AvatarRuntime

- **WHEN** the operator opens `/mcp` while one owner Avatar has no running AvatarRuntime
- **THEN** the workbench still reads that Avatar's MCP globals
- **AND** add, enable, lifecycle, and call actions target Avatar-owned MCP authority
- **AND** no Studio-local MCP database is created

#### Scenario: Config owner controls config mutation facts

- **WHEN** the operator creates or edits config `fs`
- **THEN** that config keeps one explicit owner Avatar as part of config truth
- **AND** save, enable, start, and remove actions target that owner Avatar
- **AND** the `Configs` surface does not require a page-level Avatar selector

### Requirement: MCP workbench SHALL separate config truth from Avatar-owned instance projection

The MCP workbench SHALL show global MCP configs separately from Avatar-owned exact-project instances. `Configs` SHALL organize durable config truth first; `Avatars` SHALL organize ownership and instance projection first.

#### Scenario: MCP home exposes configs and avatars

- **WHEN** the operator opens `/mcp`
- **THEN** the page toolbar exposes `Configs` and `Avatars` tabs
- **AND** `Configs` is a config-first list-detail surface
- **AND** `Avatars` is an Avatar-first ownership overview

#### Scenario: Configs list starts with new-item

- **WHEN** the operator opens `Configs`
- **THEN** the first list item is `New config`
- **AND** the remaining list items are installed global MCP configs
- **AND** each config row uses a single-column layout with the owner Avatar shown as the first-line avatar affordance
- **AND** hovering that avatar reveals the Avatar name
- **AND** clicking that avatar jumps to the matching Avatar in the `Avatars` tab
- **AND** selecting a config does not navigate away from the shared list-detail surface

#### Scenario: Config detail reuses one form for new and edit

- **WHEN** the operator selects `New config`
- **THEN** the detail pane renders the global config form in create mode
- **AND** save adds one inert global config by default
- **AND** exact-project enablement and lifecycle controls stay in config detail after install
- **AND** the form can switch between `Form` and `Code` editing modes for the same draft
- **AND** `Code` mode accepts direct JSON copy/paste for the config draft

#### Scenario: Existing config detail shows read-only exact-project instances

- **GIVEN** global MCP `fs` exists
- **AND** exact projects have enabled or started `fs`
- **WHEN** the operator selects config `fs`
- **THEN** the detail pane renders the config form in edit mode
- **AND** it shows a read-only list of exact-project instances for `fs`
- **AND** those instance rows stay visually secondary to the global config form

#### Scenario: Avatars tab shows ownership without config mutation

- **WHEN** the operator opens `Avatars`
- **THEN** each Avatar row summarizes config count, exact-project count, and running or failed instance counts
- **AND** the detail pane expands owned configs and exact-project instances for the selected Avatar
- **AND** the list and detail use the standard avatar affordance for owner identity
- **AND** this surface stays read-only for config mutation

### Requirement: MCP config detail SHALL expose safe global creation and edit actions

The MCP config detail SHALL expose global config creation, edit, and remove while preserving existing MCP defaults. Exact-project enable and start MAY be opted into during save, but config mutation SHALL remain distinct from Avatar ownership overview.

#### Scenario: Global add remains inert

- **WHEN** the operator adds a global MCP config from the workbench
- **THEN** the global config is persisted through the Avatar-owned MCP facade
- **AND** no project is enabled
- **AND** no MCP server is started

#### Scenario: Config detail can probe the current draft without install

- **WHEN** the operator uses `Inspect` from new or edit detail
- **THEN** Studio opens an `mcp probe` isolated session for the current draft transport without installing or mutating durable config truth
- **AND** it can render the returned connection snapshot through structured visual and raw views
- **AND** it can ping the server, call tools, read resources, get prompts, and show resource templates or MCP app resources reported by the protocol
- **AND** card interactions use protocol identifiers such as tool name, resource URI, prompt name, or app resource URI while displaying human labels separately
- **AND** the raw view exposes the CLI-shaped `mcp probe` envelope for correlation without adding persistent tutorial copy

#### Scenario: Owner avatar in detail is a jump affordance

- **WHEN** the operator clicks the owner Avatar in config detail
- **THEN** Studio opens the `Avatars` tab
- **AND** selects the matching Avatar owner

#### Scenario: New requires explicit override for same config id

- **GIVEN** owner Avatar `default` already has global MCP id `fs`
- **WHEN** the operator submits a new config with id `fs`
- **THEN** Studio warns that the id already exists
- **AND** asks the operator to choose `Override` or `Cancel`
- **AND** it does not silently replace the existing global config

#### Scenario: Remove blocked by running project requires explicit stop confirmation

- **GIVEN** global MCP `fs` has a running instance in project `/repo/app`
- **WHEN** the operator removes global MCP `fs` without choosing to stop running instances
- **THEN** the workbench shows the blocked project path returned by the runtime
- **AND** the global config remains visible
- **AND** retrying with stop requires an explicit destructive confirmation

### Requirement: MCP workbench SHALL render config and ownership facts as bounded structured projections

The MCP workbench SHALL render transport summaries, instance summaries, latest errors, and action facts through bounded structured projections rather than raw unbounded text dumps.

#### Scenario: Config detail uses bounded structured presentation

- **WHEN** a config transport summary or instance projection includes structured data
- **THEN** the detail pane renders the data in bounded sections
- **AND** long JSON values remain scrollable or collapsible inside the detail surface
- **AND** config truth and instance truth remain visually distinct

### Requirement: MCP workbench SHALL preserve a low-noise operator surface

The MCP workbench SHALL be designed for expert operators who repeatedly use Studio. Primary page space SHALL show actionable MCP state, controls, and inspection facts rather than persistent introductory prose. Explanatory context, caveats, and low-frequency recovery guidance SHALL be collapsed into contextual help such as `HelpHint`, title/aria help, dialogs, or focused empty/error states. The page SHALL avoid nested card stacks and repeated borders when the existing Studio shell, split-detail surface, spacing, or a lightweight divider can express the same structure.

#### Scenario: Primary surface avoids tutorial copy

- **WHEN** the operator opens `/mcp` with runtime data available
- **THEN** the toolbar, list, and detail surfaces prioritize runtime, project, server, lifecycle, snapshot, and action facts
- **AND** the page does not render persistent introductory paragraphs explaining what MCP is or how every control works
- **AND** low-frequency conceptual help is available through contextual help affordances instead

#### Scenario: Detail surface avoids nested card stacks

- **WHEN** the MCP detail surface renders global config, project enablement, snapshots, latest errors, and action facts
- **THEN** those sections use the shared drawer/split-detail surface, compact section headings, spacing, and lightweight dividers
- **AND** they do not wrap each subsection in separate nested cards unless the subsection owns an independent interaction state such as a dialog, repeated row, or structured value frame
- **AND** border usage remains tied to actual ownership boundaries or clickable affordances

#### Scenario: Connection failures stay local to the active surface

- **WHEN** MCP connect, inspect, or lifecycle actions fail
- **THEN** Studio keeps the `Configs` list and current detail surface mounted
- **AND** it renders the failure through a focused error banner or local inspect error state
- **AND** it does not replace the whole workbench column with raw exception text

#### Scenario: HelpHint carries repeated explanation

- **WHEN** the UI needs to explain global-vs-project law, auto-start/auto-enable defaults, blocked removal, or stale stopped snapshots
- **THEN** the explanation is reachable from `HelpHint`, tooltip, or focused dialog text
- **AND** the same explanation is not repeated as permanent body copy on every normal page render

### Requirement: MCP workbench SHALL have responsive BDD coverage

The MCP workbench SHALL include BDD-style tests that cover app-shell navigation, runtime scoping, project projection, lifecycle gating, blocked removal, snapshot rendering, and responsive desktop/mobile layout behavior.

#### Scenario: Storybook DOM covers configs and avatars projections

- **WHEN** the MCP workbench Storybook DOM tests run
- **THEN** stories cover `New config`, config edit with read-only instances, config running summary, and Avatar ownership overview
- **AND** those stories assert visible behavior rather than private component state

#### Scenario: Route smoke covers desktop and mobile

- **WHEN** route-level MCP smoke acceptance runs
- **THEN** `/mcp` is reachable on desktop
- **AND** `/mcp` is reachable through the compact navigation path on the iPhone 14 viewport
- **AND** the main MCP list-detail workflow remains usable without overlapping controls
