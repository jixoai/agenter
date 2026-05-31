## ADDED Requirements

### Requirement: Offscreen frame projection SHALL own semantic selection gestures

The offscreen frame projection component SHALL own terminal-like semantic selection gestures for projected cells. Double-click SHALL select one word using ICU word segmentation, and triple-click SHALL select one row. Gesture selections SHALL reuse the same bounded paint and copy path as drag selection.

#### Scenario: Double click selects a segmented word
- **WHEN** the user double-clicks a word-like segment inside a projected terminal region
- **THEN** the offscreen frame projection SHALL select exactly that segment
- **AND** it SHALL use `Intl.Segmenter(undefined, { granularity: "word" })` with `isWordLike`
- **AND** it SHALL NOT split words by ASCII whitespace only

#### Scenario: Triple click selects a bounded row
- **WHEN** the user triple-clicks a row inside a projected terminal region
- **THEN** the offscreen frame projection SHALL select the clicked row's text range
- **AND** the selected range SHALL remain bounded to the active owner region

#### Scenario: Semantic selection uses the normal copy path
- **WHEN** a word or row is selected by double-click or triple-click
- **THEN** copy extraction SHALL return text through the same selected-text path as drag selection
- **AND** app code SHALL NOT implement a separate copy algorithm for semantic selections

### Requirement: Offscreen terminal input SHALL request backend cursor follow

When shell input is sent through an offscreen terminal projection, the projection layer SHALL request the backend viewport to follow the backend cursor instead of changing local viewport state.

#### Scenario: Keyboard input follows the cursor
- **WHEN** the user has scrolled away from the cursor and sends shell keyboard input
- **THEN** the input path SHALL send the encoded terminal input bytes to the backend
- **AND** it SHALL request the existing backend follow-cursor bridge
- **AND** it SHALL NOT create a local frontend viewport override

#### Scenario: Failed input does not move viewport
- **WHEN** terminal input bytes are not accepted by the backend
- **THEN** the projection layer SHALL NOT request follow-cursor

### Requirement: Offscreen scrollbar progress SHALL be visible backend projection

The offscreen terminal scrollbar SHALL visibly project backend scroll progress from backend `scrollSize`, `viewportSize`, and `scrollPosition`. User scrollbar interactions SHALL produce backend viewport target requests; visual progress SHALL update only from backend state.

#### Scenario: Scrollbar thumb reflects backend viewport
- **WHEN** backend viewport state changes
- **THEN** the offscreen scrollbar SHALL update its visible thumb/progress position from backend state
- **AND** the compositor SHALL NOT draw a replacement scrollbar

#### Scenario: Scrollbar input requests backend target
- **WHEN** the user clicks or drags the scrollbar
- **THEN** the offscreen scrollbar SHALL send a backend viewport target request
- **AND** it SHALL wait for backend state to update the visible progress

