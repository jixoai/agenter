## Purpose

Define terminal-id-centered activity inspection surfaces.

## Requirements

### Requirement: Terminal pages SHALL expose terminal-id-centered activity inspection
The terminal page SHALL let users inspect runtime facts related to the selected terminal id, including terminal reads/writes and other related tool or attention records that reference that terminal.

#### Scenario: Filter facts by terminal id
- **WHEN** a terminal page is focused on one `terminalId`
- **THEN** its activity inspector shows only facts related to that `terminalId`
- **THEN** unrelated terminal activity stays hidden

### Requirement: Terminal activity SHALL load as a paged long-history timeline
The terminal activity inspector SHALL load terminal facts through a server-backed reverse-time page contract instead of requiring the browser to scan all loaded cycles.

#### Scenario: Terminal activity prepends older rows
- **WHEN** the user requests older activity for a terminal with a long history
- **THEN** the inspector prepends the older rows in chronological order
- **THEN** the current visible context remains stable while loading
