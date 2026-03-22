## Purpose

Define terminal-id-centered activity inspection surfaces.

## Requirements

### Requirement: Terminal pages SHALL expose terminal-id-centered activity inspection
The terminal page SHALL let users inspect runtime facts related to the selected terminal id, including terminal reads/writes and other related tool or attention records that reference that terminal.

#### Scenario: Filter facts by terminal id
- **WHEN** a terminal page is focused on one `terminalId`
- **THEN** its activity inspector shows only facts related to that `terminalId`
- **THEN** unrelated terminal activity stays hidden
