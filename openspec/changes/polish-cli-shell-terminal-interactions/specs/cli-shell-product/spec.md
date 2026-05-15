## ADDED Requirements

### Requirement: Cli-shell shell input SHALL return scrolled shell viewport to cursor

Cli-shell SHALL return the shell viewport to the cursor position when shell input is sent while the user has scrolled away from the cursor.

#### Scenario: Typing while scrolled follows the cursor
- **WHEN** the shell viewport is scrolled away from the cursor
- **AND** the user types shell input
- **THEN** cli-shell SHALL send terminal input to terminal-1
- **AND** cli-shell SHALL request the backend viewport to target the cursor row
- **AND** the visible shell result SHALL return through terminal-2 frame synchronization

#### Scenario: Dialogue typing does not move shell viewport
- **WHEN** dialogue input is focused
- **AND** the user types dialogue text
- **THEN** cli-shell SHALL update dialogue input state
- **AND** it SHALL NOT request shell follow-cursor

### Requirement: Cli-shell terminal selection SHALL support word and row gestures

Cli-shell SHALL support terminal-like word and row selection gestures in projected shell and dialogue regions.

#### Scenario: Double click selects one word
- **WHEN** the user double-clicks a word-like segment inside shell or dialogue projected text
- **THEN** cli-shell SHALL select that word using the offscreen frame projection's segmented-word selection
- **AND** copy SHALL return the selected word

#### Scenario: Triple click selects one row
- **WHEN** the user triple-clicks inside shell or dialogue projected text
- **THEN** cli-shell SHALL select the clicked row inside that region
- **AND** copy SHALL return that row text without neighboring product chrome

#### Scenario: Word and row selection stay inside owner region
- **WHEN** semantic selection starts in shell or dialogue
- **THEN** the selection SHALL remain inside that owner region
- **AND** it SHALL NOT include scrollbar, status toolbar, or the other region's text

### Requirement: Cli-shell shell scrollbar SHALL show backend progress

Cli-shell SHALL show a visible shell scrollbar thumb/progress that reflects backend viewport state.

#### Scenario: Scrollbar progress changes after backend scroll
- **WHEN** backend shell viewport state changes from top to a later scroll position
- **THEN** cli-shell SHALL render a visibly different scrollbar progress position
- **AND** the visual state SHALL come from shell offscreen renderer backend state

#### Scenario: Scrollbar click and drag stay backend-driven
- **WHEN** the user clicks or drags the shell scrollbar
- **THEN** cli-shell SHALL send backend viewport target requests
- **AND** it SHALL NOT locally commit scrollbar progress before backend state returns

