## MODIFIED Requirements

### Requirement: Flutter chat view SHALL expose product-grade transcript affordances
The Flutter chat stage SHALL render a conversation-first transcript with restrained time dividers, message selection, and a return-to-latest affordance so a host shell can deliver long-lived room browsing without reverting to demo-style flat rendering.

Transcript and Web demo shell surfaces SHALL avoid `SelectableRegion`, `HtmlElementView`, and Flutter Web platform views. Text copy SHALL be exposed through stable message actions so virtualized rows and return-to-latest motion do not leave platform-view layout callbacks attached to disposed render objects.

When entering a non-empty room transcript, the stage SHALL initially anchor the viewport to the latest message at the bottom. While the operator remains near the latest edge, incoming messages SHALL keep the viewport near latest. When the operator scrolls near the top and older history is available, the stage SHALL request the next reverse page through the controller and preserve the visible anchor after older messages are prepended.

#### Scenario: Transcript opens at latest
- **WHEN** the chat stage first renders a non-empty transcript
- **THEN** the viewport is anchored to the newest message edge
- **THEN** the operator sees the latest room messages without manually tapping "Latest"

#### Scenario: Upward scrolling loads older history
- **WHEN** the transcript has `hasMoreBefore` and the operator scrolls near the top
- **THEN** the stage requests an older page through the canonical `page` action
- **THEN** it does not emit repeated page requests while an older page is already loading

#### Scenario: Older history preserves the visible anchor
- **WHEN** older messages are merged above the currently visible transcript content
- **THEN** the viewport adjusts by the inserted extent
- **THEN** the operator does not lose their current reading position
