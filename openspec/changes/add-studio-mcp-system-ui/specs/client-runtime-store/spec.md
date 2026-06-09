## ADDED Requirements

### Requirement: Client runtime store SHALL expose a typed MCP facade

The client runtime store SHALL expose typed MCP facade methods for browser products to inspect and mutate Avatar-owned MCP state through daemon contracts. Feature routes SHALL NOT construct raw descriptor payloads or import MCP implementation internals for normal MCP workbench behavior.

#### Scenario: Studio reads MCP projections through runtime store

- **WHEN** Studio needs MCP globals or project projection rows
- **THEN** it calls typed runtime-store MCP methods
- **AND** the store forwards the selected Avatar nickname and query parameters to the daemon contract
- **AND** the route does not import app-server MCP implementation modules

#### Scenario: Studio mutates MCP through runtime store

- **WHEN** Studio adds, removes, enables, disables, starts, stops, restarts, or calls an MCP server
- **THEN** it uses typed runtime-store MCP methods
- **AND** those methods preserve the existing MCP input defaults such as `remove.stop = false`, `disable.stop = true`, `call.autoStart = true`, and `call.autoEnable = false`
- **AND** feature code does not hand-build root-workspace shell commands for these actions

#### Scenario: Studio probes an unsaved MCP draft through runtime store

- **WHEN** Studio tests a draft MCP transport from config detail before install
- **THEN** it uses the typed runtime-store `mcp probe` method
- **AND** the method returns the CLI-shaped `stdin`, `stdout`, `stderr`, `exitCode`, and parsed result envelope
- **AND** Studio can render connection snapshot data, ping results, tool calls, resource reads, prompt gets, resource templates, and MCP app resources from that probe path
- **AND** Studio does not emulate probe by silently installing, enabling, starting, or persisting durable MCP truth

### Requirement: Client runtime store SHALL preserve MCP global and project identity separately

The client runtime store SHALL keep MCP global config identity, exact project enablement identity, lifecycle rows, snapshots, and action outcomes distinguishable in its MCP facade outputs. It SHALL NOT collapse global existence into project availability.

#### Scenario: Global row does not imply project enablement

- **GIVEN** Avatar MCP projection includes global MCP `fs`
- **AND** project `/repo/app` has default-disabled projection for `fs`
- **WHEN** the store returns data to Studio
- **THEN** the global identity remains present
- **AND** the project row reports disabled/default state separately
- **AND** lifecycle controls can derive disabled gating without guessing from global existence

#### Scenario: Project-local snapshots stay scoped

- **GIVEN** Avatar MCP projection contains a snapshot for `fs` under `/repo/a`
- **WHEN** Studio queries exact project `/repo/b`
- **THEN** the store does not return `/repo/a` snapshot as `/repo/b` snapshot truth
- **AND** the UI receives either `/repo/b` snapshot data or an explicit missing snapshot state

### Requirement: Client runtime store SHALL surface MCP mutation outcomes without hiding blocked states

The client runtime store SHALL return structured mutation outcomes for MCP operations, including blocked removal projects, lifecycle errors, tool-call results, and validation failures. It SHALL NOT coerce blocked or failed MCP operations into silent success.

#### Scenario: Blocked remove remains observable

- **WHEN** Avatar MCP remove returns `removed: false` with blocked project paths
- **THEN** the store returns those blocked project paths to the caller
- **AND** it does not optimistically remove the global from cached MCP data as if the removal succeeded

#### Scenario: Lifecycle error remains observable

- **WHEN** Avatar MCP start, stop, or restart fails
- **THEN** the store exposes the error to the caller
- **AND** it keeps the previous visible MCP projection until a later refresh replaces it

#### Scenario: Tool call result is structured

- **WHEN** Avatar MCP call succeeds or fails
- **THEN** the store returns the structured result or structured error to the caller
- **AND** Studio can render the result through structured value presentation without parsing a text blob
