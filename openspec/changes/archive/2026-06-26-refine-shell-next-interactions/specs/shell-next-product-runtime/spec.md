## ADDED Requirements

### Requirement: Shell-next interactive chrome SHALL use shared bracketed button affordances

Shell-next SHALL render pane-title actions and statusbar actions with a shared bracketed button affordance. Hover state SHALL apply bold styling to the whole bracketed label, and active state SHALL apply underline styling without replacing the action glyph or label.

#### Scenario: Chat layout actions use underline active state
- **WHEN** the Chat pane is docked left, docked right, or floating
- **THEN** its title actions remain `[←]`, `[→]`, and the floating icon action
- **AND** only the action matching the current Chat layout mode is underlined
- **AND** active state does not replace the label with a different glyph

#### Scenario: Hover styling is scoped to one button
- **WHEN** the pointer hovers over a pane-title or statusbar action
- **THEN** only that bracketed action is bolded
- **AND** sibling actions do not receive the hover style

#### Scenario: Statusbar actions use bracketed button labels
- **WHEN** mixed shell-next host mode renders the bottom statusbar
- **THEN** the Help and Chat actions render as `[Help] [Chat]`
- **AND** the active statusbar action is underlined when the corresponding surface is open

### Requirement: Resize handles SHALL support drag and click resize

Shell-next resize handles SHALL preserve drag resizing and SHALL also resize by one cell when the user clicks the visible horizontal or vertical handle without dragging.

#### Scenario: Horizontal resize handle click moves one cell
- **WHEN** two panes share a vertical border
- **AND** the user clicks the visible `◀▶` handle without dragging
- **THEN** the adjacent pane boundary moves by one column

#### Scenario: Vertical resize handle click moves one cell
- **WHEN** two panes share a horizontal border
- **AND** the user clicks the visible `▲▼` handle without dragging
- **THEN** the adjacent pane boundary moves by one row

#### Scenario: Drag resize remains available
- **WHEN** the user drags a resize handle by multiple cells
- **THEN** shell-next applies the dragged delta to the layout
- **AND** the handle visuals remain attached to the pane border junction

### Requirement: Terminal backend resize SHALL be debounced and coalesced

Shell-next terminal panes SHALL update visual frame geometry immediately during layout changes, but SHALL debounce terminal backend `resize` delivery and coalesce rapid size changes so only the newest pending terminal size is sent.

#### Scenario: Rapid terminal pane resize sends the final backend size
- **WHEN** a terminal pane receives several layout size changes inside the resize debounce window
- **THEN** shell-next sends at most one backend resize request after the window
- **AND** that request contains the newest terminal cols and rows

#### Scenario: Stable terminal pane resize is delivered
- **WHEN** a terminal pane receives a new size and no newer size replaces it before the debounce window expires
- **THEN** shell-next sends that size to the terminal source

### Requirement: Close-confirm top-layer hit regions SHALL align with visible actions

Shell-next close-confirm top-layer SHALL compute mouse hit regions from the same visible cells that render the border close action and action buttons.

#### Scenario: Visible close-confirm buttons trigger callbacks
- **WHEN** the close-confirm dialog is visible
- **AND** the user clicks inside the visible `[ Run in background ]` button
- **THEN** shell-next runs the background callback
- **AND** clicking the row above that visible button does not run the callback

#### Scenario: Visible terminate button triggers terminate
- **WHEN** the close-confirm dialog is visible
- **AND** the user clicks inside the visible `[ Terminate terminal ]` button
- **THEN** shell-next runs the terminate callback

#### Scenario: Border close action cancels only
- **WHEN** the close-confirm dialog is visible
- **AND** the user clicks the visible border `[x]` action
- **THEN** shell-next cancels the dialog
- **AND** it does not run background or terminate callbacks

### Requirement: Shell-next copy behavior SHALL be source-family aware

Shell-next SHALL route terminal-pane copy through the terminal protocol source and renderer-pane copy through the OpenTUI renderer selection. Completed renderer selections SHALL request OSC52 primary copy, and copy shortcuts SHALL request clipboard copy without stealing terminal input outside copy chords.

#### Scenario: ShellPane copy shortcut uses terminal selection truth
- **WHEN** a terminal-protocol pane is focused
- **AND** the user presses the host copy shortcut
- **THEN** shell-next calls the terminal source copy-selection API
- **AND** if the source returns selected text, shell-next writes it to OSC52 clipboard

#### Scenario: Renderer selection mirrors to primary
- **WHEN** a renderer pane selection finishes with selected text
- **THEN** shell-next requests OSC52 primary copy for that text

#### Scenario: Renderer copy shortcut copies to clipboard and primary
- **WHEN** a renderer pane has selected text
- **AND** the user presses the host copy shortcut
- **THEN** shell-next requests OSC52 clipboard copy
- **AND** shell-next also requests OSC52 primary copy
