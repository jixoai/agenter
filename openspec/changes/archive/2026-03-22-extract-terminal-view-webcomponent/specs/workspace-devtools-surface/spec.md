## MODIFIED Requirements

### Requirement: Devtools SHALL embed the standalone terminal renderer instead of owning terminal rendering internals
The Devtools surface SHALL consume the standalone `terminal-view` renderer contract and keep its own responsibility limited to layout, selection, and surrounding inspection controls.

#### Scenario: Devtools hosts a terminal-view instance
- **WHEN** the Devtools surface renders a terminal panel
- **THEN** it embeds the standalone `terminal-view` component for the terminal body
- **THEN** Devtools-specific code does not re-implement xterm rendering internals locally
