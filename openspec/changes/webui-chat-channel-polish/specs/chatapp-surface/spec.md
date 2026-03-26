## ADDED Requirements

### Requirement: ChatApp channel metadata SHALL use passive signal disclosure
The ChatApp surface SHALL expose channel metadata through a passive signal disclosure aligned with the channel tabs instead of dedicating a full metadata row above the transcript.

#### Scenario: Metadata opens from the tab row
- **WHEN** the user needs to inspect chat-channel metadata such as title, identifier, or participant summary
- **THEN** the Chat route shows a compact signal trigger adjacent to the channel tabs
- **THEN** activating the trigger opens a secondary metadata surface without shrinking the transcript with an extra metadata bar

#### Scenario: Desktop and compact layouts keep the same metadata affordance model
- **WHEN** the Chat route is rendered on desktop or compact widths
- **THEN** the metadata disclosure remains a compact signal trigger plus secondary surface in both layouts
- **THEN** the route does not swap to a separate desktop-only metadata row or status bar
