## ADDED Requirements

### Requirement: Cli-shell SHALL use normalized tmux app actions for status clicks

Cli-shell SHALL normalize tmux status-bar mouse range payloads before dispatching app actions. The action boundary SHALL accept both direct action names such as `help` and user-range forms such as `user|help` for known app actions. Unknown range payloads SHALL fail as unknown actions without mutating Chat surface state.

#### Scenario: Help click normalizes user range

- **WHEN** tmux dispatches `mouse_status_range = user|help` to `tmux-action`
- **THEN** cli-shell executes the same Help popup action as `help`
- **AND** it does not report `unknown-action`

#### Scenario: Chat click normalizes user range

- **WHEN** tmux dispatches `mouse_status_range = user|chat` to `tmux-action`
- **THEN** cli-shell executes the same Chat toggle action as `chat`
- **AND** it does not report `unknown-action`

#### Scenario: Help takes over an existing popup on the same client

- **GIVEN** the Chat surface state is popup
- **WHEN** the user clicks Help or presses the Help shortcut on the same tmux client
- **THEN** cli-shell closes the existing client popup before opening Help
- **AND** it clears the Chat popup presentation state
- **AND** it restores the status highlight after Help closes

### Requirement: Cli-shell Chat SHALL be a singleton tmux surface

Cli-shell SHALL maintain exactly one visible Chat surface per tmux session and selected Avatar. The legal presentation states are closed, popup, and pane. Status-bar Chat, dock fallback, and Room titlebar layout requests SHALL all transition that same state instead of creating independent Room owners.

#### Scenario: Chat status action toggles closed to saved default layout

- **GIVEN** the Chat surface state is closed
- **WHEN** the user clicks Chat or presses the Chat shortcut
- **THEN** cli-shell opens one Room surface using the saved default layout
- **AND** the active status highlight changes to Chat

#### Scenario: Chat status action toggles popup closed

- **GIVEN** the Chat surface state is popup
- **WHEN** the user clicks Chat or presses the Chat shortcut again
- **THEN** cli-shell closes that popup surface
- **AND** it restores shell focus and shell status highlight
- **AND** it does not start a second Room process

#### Scenario: Chat status action toggles pane closed

- **GIVEN** the Chat surface state is pane with a valid pane id
- **WHEN** the user clicks Chat or presses the Chat shortcut again
- **THEN** cli-shell kills only that Chat pane
- **AND** it restores focus to a remaining shell pane
- **AND** it clears the Chat surface state

#### Scenario: Layout request moves singleton pane without restarting Room

- **GIVEN** the singleton Chat surface is visible as a pane
- **WHEN** the user requests the opposite pane layout from the Room titlebar
- **THEN** cli-shell moves the same tmux pane to the requested side
- **AND** it does not start a second Room process
- **AND** it does not kill the existing Room pane

#### Scenario: Layout request moves singleton from pane to popup

- **GIVEN** the singleton Chat surface is visible as a pane
- **WHEN** the user requests cover layout from the Room titlebar
- **THEN** cli-shell closes the pane before opening the popup Room surface
- **AND** only one Room surface remains visible

#### Scenario: Layout request moves singleton from popup to pane

- **GIVEN** the singleton Chat surface is visible as a popup
- **WHEN** the user requests left or right layout from the Room titlebar
- **THEN** cli-shell closes the popup and opens one pane Room surface
- **AND** only one Room surface remains visible
