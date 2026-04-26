## MODIFIED Requirements

### Requirement: Flutter chat view SHALL keep product-shell copy and adaptive navigation localizable and accessible
The Flutter chat package and its standalone Web product shell SHALL expose durable UI copy through localization delegates, SHALL keep translated copy out of controller/model truth, and SHALL provide baseline Web accessibility via semantics, keyboard reachability, and an adaptive shell that preserves the same capabilities across compact, standard, and expanded layouts.

The standalone product shell SHALL use Apple platform primitives for app-level chrome, conversation content, inspector, icon actions, action sheets, pushed pages, and content-unavailable states. Product code SHALL not hand-roll page-level Apple materials from raw background, clipping, and border values.

Compact active conversation routing SHALL be conversation-first: the transcript and composer SHALL own the chat screen, and persistent bottom app navigation SHALL NOT appear on the active compact chat page. Profiles, room facts, participants, and selected-message facts SHALL remain reachable through explicit secondary or tertiary navigation surfaces instead of peer bottom tabs.

Compact secondary and tertiary route surfaces SHALL use semantic sheet detents owned by the host-shell sheet primitive. Profile directory surfaces SHALL use a large page-style detent. Room and selected-message inspector surfaces SHALL use an inspector detent that remains clearly intentional, scrollable, and safe-area aware. Feature code SHALL select the semantic detent, not raw popup heights.

Icon-only product-shell actions SHALL expose exactly one labeled semantic button while preserving at least a 44pt hit target. Those icon-only actions SHALL also expose visible tooltip or long-press help derived from the same localized label without creating a duplicate semantic button.

#### Scenario: Icon-only action exposes help without duplicate semantics
- **WHEN** the product shell renders an icon-only action
- **THEN** the action has a localized semantic button label
- **THEN** the action exposes tooltip or long-press help from that same label
- **THEN** the tooltip does not create a second semantic button
