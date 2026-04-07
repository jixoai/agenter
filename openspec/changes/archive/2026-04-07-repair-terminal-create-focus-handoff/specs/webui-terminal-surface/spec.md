## MODIFIED Requirements

### Requirement: Terminals page SHALL expose a tabbed terminal workbench
The top-level `Terminals` page SHALL expose the running global terminal catalog as a tabbed workbench with one terminal-local toolbar and a fixed `New terminal` tab that focuses the created terminal after a successful create flow.

#### Scenario: Running terminals appear as tabs
- **WHEN** more than one terminal is available in the global terminal catalog
- **THEN** the page shows a tab strip for terminal switching
- **THEN** tab labels use the terminal display title and status instead of raw ids only

#### Scenario: Toolbar keeps terminal-local controls
- **WHEN** the user is viewing the `Terminals` page
- **THEN** the terminal-local toolbar exposes controls such as theme or shortcut affordances on the leading side
- **THEN** those controls remain local to the terminal surface instead of leaking into unrelated shell chrome

#### Scenario: Terminal toolbar does not own collaboration focus
- **WHEN** the user is viewing the top-level `Terminals` page
- **THEN** the toolbar keeps terminal-local presentation controls only
- **THEN** actor focus or unfocus actions live in the terminal Users panel instead of a global toolbar button

#### Scenario: Creating a terminal focuses the created tab
- **WHEN** the operator submits the fixed `New terminal` tab successfully
- **THEN** the browser lands on `/terminals/{terminalId}` for the created terminal
- **AND** the created terminal becomes the active workbench tab instead of leaving the previous terminal selected
