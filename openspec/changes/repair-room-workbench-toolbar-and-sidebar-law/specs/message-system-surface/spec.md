## MODIFIED Requirements

### Requirement: Message-system route SHALL place secondary room controls responsively

The message-system route SHALL render the selected room as one workbench window with explicit `chrome_tabs`, `page_toolbar`, and `page_content` bands. The room toolbar SHALL remain a fixed-height chrome band above the transcript stage, and compact layouts SHALL reflow toolbar actions and chips without overlapping transcript content.

#### Scenario: Room toolbar stays outside transcript flow
- **WHEN** a room is selected on desktop
- **THEN** the toolbar avatar, viewer title, actions, and chips render inside the fixed `page_toolbar` band
- **AND** those controls do not visually overlap the transcript list

#### Scenario: Compact room chrome does not collide with transcript
- **WHEN** the operator uses the room surface on an iPhone 14-sized viewport
- **THEN** room tabs and toolbar content compact or wrap inside their own chrome bands
- **AND** the transcript remains the primary visible stage below that chrome
