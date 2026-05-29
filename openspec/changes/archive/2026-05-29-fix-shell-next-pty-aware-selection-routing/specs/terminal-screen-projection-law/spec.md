## ADDED Requirements

### Requirement: Projection hosts SHALL project terminal pointer coordinates through backend row truth

Projection hosts SHALL pass both backend-absolute selection coordinates and viewport-local PTY coordinates to the backend utility. Scrolled terminal views SHALL use the backend viewport start as `selectionSources.sourceStartRow` or an equivalent source-row projection so double-click, triple-click, drag, overlays, and copy text remain in backend row coordinates.

#### Scenario: Scrolled double-click selects the absolute backend word

- **GIVEN** a terminal viewport starts at backend row 20
- **WHEN** the operator double-clicks local row 1
- **THEN** the projection host sends backend row 21 to the selection controller
- **AND** word segmentation still uses the backend `Intl.Segmenter` selection algorithm

#### Scenario: Scrolled drag selection uses absolute backend rows

- **GIVEN** a terminal viewport starts at backend row 10
- **WHEN** the operator drags from local row 0 to local row 2
- **THEN** the projection host sends selection start/update/end rows 10 through 12

#### Scenario: Primary copy only follows finalized selection

- **GIVEN** a pointer-up dispatch result is `pty-mouse`
- **WHEN** the projection host handles the result
- **THEN** it does not request primary selection copy
- **AND** primary copy remains reserved for `selection-finalized`
