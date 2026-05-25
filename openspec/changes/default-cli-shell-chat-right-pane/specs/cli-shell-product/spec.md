## MODIFIED Requirements

### Requirement: Cli-shell SHALL own product-local settings and keybindings

Cli-shell SHALL keep its product-local preferences under `~/.agenter/cli-shell/`. `settings.json` stores durable product behavior such as the default Chat layout. `keybindings.json` stores product shortcut bindings for the Room composer and related panels. Missing, empty, or invalid product config files SHALL fall back to cli-shell defaults instead of mutating shared core settings truth. The built-in Chat default layout SHALL be `right`.

#### Scenario: Missing product config falls back to cli-shell defaults

- **WHEN** cli-shell starts and `~/.agenter/cli-shell/settings.json` or `keybindings.json` does not exist, is empty, or is invalid
- **THEN** cli-shell uses built-in product defaults
- **AND** the built-in Chat layout default is `right`
- **AND** it does not write into shared core settings state just to recover those defaults

#### Scenario: Persisted Chat layout reopens the singleton Chat surface consistently

- **GIVEN** cli-shell has saved a default Chat layout of `left`, `right`, or `cover`
- **WHEN** the singleton Chat surface is currently closed and the user opens Chat again
- **THEN** cli-shell reopens Chat using that saved default layout

### Requirement: Cli-shell Chat SHALL be a singleton tmux surface

Cli-shell SHALL maintain exactly one visible Chat surface per tmux session and selected Avatar. The legal presentation states are closed, popup, and pane. Default tmux attach SHALL open or reuse the singleton Chat surface as a right dock pane. Status-bar Chat, dock fallback, and Room titlebar layout requests SHALL all transition that same state instead of creating independent Room owners.

#### Scenario: Default attach opens Chat on the right

- **WHEN** cli-shell attaches to a tmux product session
- **THEN** it opens or reuses one Chat Room surface as a right dock pane
- **AND** the bottom status bar remains part of the clickable tmux pane layout
- **AND** no second Room surface is created if a matching Room pane already exists

#### Scenario: Chat status action toggles closed to saved default layout

- **GIVEN** the Chat surface state is closed
- **WHEN** the user clicks Chat or presses the Chat shortcut
- **THEN** cli-shell opens one Room surface using the saved default layout
- **AND** the active status highlight changes to Chat

#### Scenario: Cover popup is modal for status-bar mouse controls

- **GIVEN** the singleton Chat surface is visible as a popup
- **WHEN** the user relies on mouse clicks in the bottom tmux status bar
- **THEN** cli-shell does not promise those clicks as the primary control path
- **AND** the user can leave cover mode through the Chat titlebar or keyboard flow

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
