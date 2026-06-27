## MODIFIED Requirements

### Requirement: Cli-shell SHALL provide an explicit TUI dialogue panel

Cli-shell SHALL provide an Agenter dialogue panel for the app room. The panel SHALL be an explicit opened state, not a default pane and not part of the collapsed one-line toolbar. The dialogue message list SHALL use host-native scroll container semantics in native cli-shell and SHALL read durable room history through MessageRoom snapshot, page, and incremental update contracts.

#### Scenario: Dialogue panel opens on the right side
- **WHEN** the user invokes the configured dialogue-open gesture
- **THEN** cli-shell renders the app room conversation as a right-side dialogue panel
- **AND** the panel contains visible conversation structure such as user messages, Avatar replies, and a message input area
- **AND** the visible shell surface remains the single active app-terminal surface

#### Scenario: Dialogue panel toolbar exposes placement and close actions
- **WHEN** the dialogue panel is open
- **THEN** its top toolbar renders placement buttons for left, right, and floating
- **AND** it renders a close button on the right side of that toolbar

#### Scenario: Dialogue panel reads from backend room truth
- **WHEN** the dialogue panel is open for `shell-1`
- **THEN** it renders messages from the durable app room for `shell-1`
- **AND** it does not keep a separate local transcript as authoritative truth

#### Scenario: Dialogue panel closes back to one-line default
- **WHEN** the dialogue panel is open
- **AND** the user closes or cancels it
- **THEN** cli-shell returns to the one-line bottom toolbar
- **AND** terminal input ownership returns to terminal mode

#### Scenario: Dialogue panel is not default chrome
- **WHEN** cli-shell renders the dialogue panel
- **THEN** it is visible only while explicitly opened
- **AND** it does not reduce the app to a dashboard layout

#### Scenario: Dialogue message list renders Markdown with gutters and host-native scrollbar
- **WHEN** the dialogue panel renders messages in native cli-shell
- **THEN** the middle region renders terminal Markdown in an OpenTUI `ScrollBox` or equivalent explicit OpenTUI scroll primitive
- **AND** the left side reserves a gutter column
- **AND** the right side shows the Chat list scrollbar from that host-native scroll primitive or a controlled OpenTUI scrollbar projection
- **AND** user-authored messages use gray background and a `>` marker in the gutter

#### Scenario: Dialogue scroll state is not modeled as distance from bottom
- **WHEN** native cli-shell tracks dialogue list position
- **THEN** it derives visible state from the host scroll container, loaded message window, and anchor metadata
- **AND** it does not expose `dialogueScrollOffset` or any equivalent distance-from-bottom row counter as the dialogue scroll authority

#### Scenario: Dialogue message list scroll direction matches terminal expectation
- **WHEN** the user scrolls down inside the dialogue message list
- **THEN** the native scroll container moves toward newer lower content
- **AND** scrolling up moves toward older upper content

#### Scenario: Dialogue near-top scroll loads older room messages
- **GIVEN** the dialogue message list has `hasMoreBefore = true`
- **WHEN** the user scrolls near the older-history edge
- **THEN** cli-shell requests an older page from the MessageRoom history contract using the current `nextBefore` cursor
- **AND** the returned messages are prepended into the loaded dialogue window without creating another transcript store

#### Scenario: Dialogue prepend preserves visible anchor
- **GIVEN** the user is reading a visible dialogue message `M`
- **WHEN** older messages are prepended before `M`
- **THEN** message `M` remains at the same visual row in the dialogue viewport after layout settles
- **AND** the viewport does not jump to the top or bottom as a side effect of pagination

#### Scenario: Bottom-pinned dialogue follows new messages
- **GIVEN** the dialogue message list is pinned to bottom
- **WHEN** new room messages or streaming message updates arrive
- **THEN** the native scroll container follows the latest rendered content
- **AND** no return-to-bottom affordance is shown

#### Scenario: Scrolled-up dialogue preserves reader position
- **GIVEN** the user has scrolled upward away from the latest dialogue messages
- **WHEN** new room messages or streaming message updates arrive
- **THEN** the native scroll container preserves the user's visible anchor
- **AND** cli-shell shows a compact return-to-bottom or new-message affordance

#### Scenario: Successful dialogue send returns to bottom-pinned mode
- **WHEN** the user sends a message from the dialogue input
- **THEN** cli-shell clears the draft
- **AND** the dialogue list returns to bottom-pinned mode
- **AND** the dialogue panel remains open until the user explicitly closes it

#### Scenario: Dialogue message list renders short times
- **WHEN** the dialogue panel renders a message group
- **THEN** it displays a short local time token for that message group
- **AND** the short time is a view projection of the durable message timestamp rather than a replacement for message truth

#### Scenario: Dialogue message list separates date changes
- **WHEN** two adjacent visible message groups belong to different local calendar dates
- **THEN** the dialogue list renders an independent centered date divider row before the first message on the new date
- **AND** the date divider is not persisted as a message

#### Scenario: Dialogue input is focused by default
- **WHEN** the dialogue panel opens
- **THEN** the bottom input box is focused by default
- **AND** it has a one-line separator, gray background, left `>` gutter, and visible cursor
