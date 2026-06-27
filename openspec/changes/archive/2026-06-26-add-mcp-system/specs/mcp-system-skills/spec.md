## ADDED Requirements

### Requirement: MCP system SHALL ship built-in AI guidance as a runtime skill

The MCP system SHALL provide a built-in runtime skill that teaches AI how to discover and use the root-workspace `mcp` CLI across add, enable, list, SQL query, call, and lifecycle workflows; how global add differs from project enablement and live startup; and when to rely on auto-start versus manual lifecycle commands.

#### Scenario: Skill explains the overall MCP CLI model
- **WHEN** the AI expands the MCP system skill
- **THEN** the skill explains global `add/remove`, project `enable/disable/list`, SQL `query`, `call`, `start`, `stop`, and `restart`
- **AND** it points the AI to `mcp <command> --help` for exact schemas

#### Scenario: Skill teaches project exactness
- **WHEN** the AI expands the MCP system skill
- **THEN** the skill states that project path scope is exact and has no parent/child inheritance
- **AND** it tells the AI to pass the same explicit project path on every project-scoped MCP command

#### Scenario: Skill teaches default-disabled behavior
- **WHEN** the AI expands the MCP system skill
- **THEN** the skill explains that `mcp add` only creates a global MCP definition
- **AND** global MCPs are disabled in every project until `mcp enable` or an explicit `autoEnable: true` call enables them

#### Scenario: Skill teaches SQL query
- **WHEN** the AI expands the MCP system skill
- **THEN** the skill explains that `mcp query --help` exposes temporary SQL tables named `mcp_installed` and `mcp_enabled`
- **AND** it teaches that `mcp query` accepts read-only SQL
- **AND** it teaches that `mcp query` returns JSON rows only
- **AND** it teaches that disabled project status may be visible in SQL query but is excluded from `mcp list`

#### Scenario: Skill teaches supported transports and env authority
- **WHEN** the AI expands the MCP system skill
- **THEN** the skill explains that global MCP configs may use `stdio`, `streamable-http`, or `sse`
- **AND** it explains that stdio process env comes from root-workspace runtime env plus configured literal env overlays
- **AND** it does not teach a separate secret-reference system as required setup

### Requirement: MCP guidance SHALL prefer help-driven JSON usage

MCP skill content SHALL teach canonical root-workspace runtime CLI usage: use `root_bash.command` with `mcp ...` and JSON `stdin` for structured payloads, inspect `mcp <subcommand> --help` when unsure, and avoid undocumented positional or natural-language forms.

#### Scenario: Skill examples use JSON stdin
- **WHEN** the MCP system skill shows a tool invocation example
- **THEN** the example uses a minimal `root_bash.command` plus JSON `stdin`
- **AND** it does not teach natural flag forms that bypass descriptor validation

#### Scenario: Skill examples include project setup
- **WHEN** the MCP system skill shows setup examples
- **THEN** it shows `mcp add` for global setup and `mcp enable` for exact project availability
- **AND** it explains that future calls can auto-start the live session only after the MCP is enabled for the project

#### Scenario: Skill examples include SQL query
- **WHEN** the MCP system skill shows query examples
- **THEN** it shows `mcp query --help` as the first schema discovery step
- **AND** it shows at least one read-only SQL query against `mcp_installed` or `mcp_enabled`
- **AND** it treats the result as JSON row objects rather than terminal table output

#### Scenario: Skill delegates schema detail to help
- **WHEN** the skill describes an MCP subcommand
- **THEN** it summarizes the intent and recovery strategy
- **AND** it instructs the AI to use the subcommand's `--help` output for exact fields or SQL table schema

### Requirement: MCP skill SHALL teach troubleshooting without owning lifecycle truth

The MCP system skill SHALL teach how to diagnose failed startup, missing global config, disabled project MCP, missing project path, stale project-local capability snapshot, rejected SQL, and broken server process states. The skill MUST NOT become a second registry of globals, project enablement, instances, transport facts, or query schema.

#### Scenario: Skill handles startup failure
- **WHEN** an MCP use command fails because startup failed
- **THEN** the skill instructs the AI to inspect the instance, review stderr/status, and restart only the affected project/global instance
- **AND** it does not instruct the AI to edit hidden prompt state or invent a second global registry

#### Scenario: Skill handles disabled project MCP
- **WHEN** an MCP call fails because the global MCP is disabled for the project
- **THEN** the skill explains that default calls use `autoEnable: false`
- **AND** it instructs the AI to use `mcp enable` or an explicit `autoEnable: true` call only when project enablement is intended

#### Scenario: Skill handles stale or missing project snapshot
- **WHEN** the project list or SQL query is missing capability details
- **THEN** the skill explains that overview comes from latest successful discovery snapshots scoped by project/global pair
- **AND** it tells the AI to start or restart the concrete project/global instance when a fresh snapshot is needed

#### Scenario: Skill handles rejected SQL
- **WHEN** `mcp query` rejects a SQL payload
- **THEN** the skill tells the AI to inspect `mcp query --help`, keep the statement read-only, and query only documented temporary tables

#### Scenario: Skill teaches remove two-step confirmation
- **WHEN** the AI expands the MCP system skill
- **THEN** the skill teaches that `mcp remove` defaults to `stop: false`
- **AND** it instructs the AI to first try the default remove, inspect the reported projects that are still using the global, and only then call `mcp remove` with `stop: true` when removal is still intended
