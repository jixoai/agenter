## MODIFIED Requirements

### Requirement: Flutter chat view SHALL keep app-shell copy and adaptive navigation localizable and accessible
The Flutter chat package and its standalone Web app shell SHALL expose durable UI copy through localization delegates, SHALL keep translated copy out of controller/model truth, and SHALL provide baseline Web accessibility via semantics, keyboard reachability, and an adaptive shell that preserves the same capabilities across compact, standard, and expanded layouts.

The standalone app shell SHALL use Apple platform primitives for app-level chrome, conversation content, inspector, icon actions, action sheets, pushed pages, and content-unavailable states. App code SHALL not hand-roll page-level Apple materials from raw background, clipping, and border values.

Compact active conversation routing SHALL be conversation-first: the transcript and composer SHALL own the chat screen, and persistent bottom app navigation SHALL NOT appear on the active compact chat page. Profiles, room facts, participants, and selected-message facts SHALL remain reachable through explicit secondary or tertiary navigation surfaces instead of peer bottom tabs.

Compact secondary and tertiary route surfaces SHALL use semantic sheet detents owned by the host-shell sheet primitive. Profile directory surfaces SHALL use a large page-style detent. Room and selected-message inspector surfaces SHALL use an inspector detent that remains clearly intentional, scrollable, and safe-area aware. Feature code SHALL select the semantic detent, not raw popup heights.

Icon-only app-shell actions SHALL expose exactly one labeled semantic button while preserving at least a 44pt hit target.

#### Scenario: App shell adapts without losing profile, conversation, or details access
- **WHEN** the host shell renders under compact, standard, or expanded width bands
- **THEN** the operator can still reach profiles, the active conversation, room facts, participants, and selected-message facts in each band
- **THEN** those layout differences remain host-shell projections instead of package-level special cases

#### Scenario: Compact active chat reserves the bottom edge for composer
- **WHEN** the host shell renders the active conversation in compact width
- **THEN** the page does not render persistent bottom navigation for profiles/details
- **THEN** the transcript and composer remain the primary bottom-edge interaction path

#### Scenario: Compact route sheets use semantic detents
- **WHEN** the operator opens compact profile directory, room inspector, or selected-message inspector
- **THEN** the host shell presents the surface through `CompactRouteSheet` using a semantic detent
- **THEN** feature code does not pass ad-hoc raw heights to the sheet

#### Scenario: Compact profile directory is a secondary route surface
- **WHEN** the operator needs to switch, create, edit, delete, or import profiles in compact width
- **THEN** the shell exposes the profile directory through an explicit leading navigation action, pushed page, or modal sheet
- **THEN** activating a profile returns the operator to the conversation route without losing active draft, transcript, or selection state

#### Scenario: Compact room and message details are inspector surfaces
- **WHEN** the operator opens room details or selects a transcript message in compact width
- **THEN** the shell presents room facts, participants, or selected-message facts through an inspector route or sheet
- **THEN** dismissing that inspector returns to the active conversation without replacing the chat stage

#### Scenario: Standard and expanded layouts project the same route law
- **WHEN** the host shell renders under standard or expanded width bands
- **THEN** it may expose profile and inspector atoms as persistent rails when space allows
- **THEN** those persistent rails remain projections of the same route-depth model used by compact layout

#### Scenario: App shell uses Apple semantic surfaces
- **WHEN** the app shell renders profile, conversation, inspector, or empty-state UI
- **THEN** those surfaces are composed through Apple platform primitives
- **THEN** icon-only actions preserve a 44pt hit target and one localized accessibility label

#### Scenario: Recalled and empty-state copy is translated in the widget layer
- **WHEN** the UI needs recalled-state, retry, or empty transcript copy
- **THEN** the rendered text comes from localization delegates
- **THEN** the controller and durable room models continue to store objective facts instead of translated strings
