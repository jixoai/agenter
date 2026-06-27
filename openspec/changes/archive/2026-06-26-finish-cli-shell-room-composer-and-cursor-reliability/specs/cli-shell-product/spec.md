## MODIFIED Requirements

### Requirement: cli-shell Room composer SHALL support multiline editing and panel-style commands

The cli-shell Room composer SHALL be a multiline textarea host. It SHALL support normal draft editing, panel-style slash commands that temporarily occupy the composer area, and inline confirmation panels for destructive draft decisions.

#### Scenario: Room uses a multiline textarea

- **WHEN** the user opens cli-shell Chat
- **THEN** the composer is a multiline textarea with a visible cursor
- **AND** it is not limited to a one-line input field

#### Scenario: Slash command opens a panel in the composer area

- **WHEN** the user invokes a panel-style slash command such as `/history`
- **THEN** cli-shell replaces the textarea surface with a command panel in the same composer area
- **AND** pressing `Esc` exits that panel back to the textarea surface

#### Scenario: History inserts into an empty draft

- **GIVEN** the current composer draft is empty
- **WHEN** the user chooses an item from `/history`
- **THEN** cli-shell inserts that message into the current cursor position

#### Scenario: History asks before replacing a non-empty draft

- **GIVEN** the current composer draft is non-empty
- **WHEN** the user chooses an item from `/history`
- **THEN** cli-shell shows an inline confirmation panel in the composer area
- **AND** the user can either replace the current draft or keep it and insert the history item at the current cursor position

### Requirement: cli-shell Chat SHALL persist its default layout as app config

cli-shell SHALL persist the preferred default Chat layout in `~/.agenter/cli-shell/settings.json`. That persisted layout SHALL control how the singleton Chat surface reopens when currently closed.

#### Scenario: Reopen uses persisted default layout

- **GIVEN** the user has persisted a default Chat layout of `left`, `right`, or `cover`
- **WHEN** the Chat surface is currently closed and the user activates Chat from the bottom bar
- **THEN** cli-shell reopens Chat using that persisted default layout

### Requirement: cli-shell Room send SHALL separate send success from refresh failure

cli-shell SHALL model room-message send success separately from any follow-up snapshot refresh failure.

#### Scenario: Refresh failure does not rewrite send success

- **WHEN** the room message send succeeds
- **AND** the follow-up room refresh fails
- **THEN** cli-shell clears the draft and preserves the successful send result
- **AND** it surfaces the refresh failure as a separate recoverable app notice

### Requirement: cli-shell native cursor projection SHALL retain the historical offset fix

cli-shell native shell-pane projection SHALL retain the historical cursor offset fix in runtime behavior, not only in source structure.

#### Scenario: Scrolled shell projection keeps the hardware cursor visible

- **GIVEN** the backend cursor is stored as an absolute scrollback row
- **WHEN** cli-shell renders a scrolled shell-pane projection
- **THEN** the hardware cursor remains visible in the correct local viewport cell

#### Scenario: Non-zero render origin still yields the correct hardware cursor

- **GIVEN** the shell-pane renderable has a non-zero screen origin inside the native layout tree
- **WHEN** cli-shell commits the native cursor position
- **THEN** it uses the renderable screen origin plus the viewport-local cursor plus the required 1-based native offset
