# web-chat-view-framework7-visual-law Specification

## Purpose
Define the durable visual-law contract for the Framework7-first `web-chat-view` review surface, including the mobile-first review shell, one-bubble transcript law, compact composer density, and route-level screenshot evidence.
## Requirements
### Requirement: The review example SHALL present a canonical mobile-first Framework7 room shell

The `web-chat-view` example SHALL render the review room as a compact Framework7/iOS chat surface where room summary chrome is quiet, setup is secondary, and transcript/composer remain the primary task surfaces.

#### Scenario: Framework7 official component styling is the visual truth

- **WHEN** the operator aligns any review-shell page or temporary surface
- **THEN** official Framework7 component defaults and documented topology remain the visual truth for navbar, subnavbar, toolbar, tabbar, searchbar, list, sheet, popup, popover, and messages surfaces
- **AND** `change`, blueprint, or mockup artifacts only constrain information architecture, responsibilities, and flows
- **AND** host-local CSS may solve layout ownership or sizing, but it must not invent a second visual language for official Framework7 components
- **AND** version-current official topology changes such as `ToolbarPane` or the canonical `Navbar -> Subnavbar(inner={false}) -> Searchbar` tree take precedence over older local shell assumptions

#### Scenario: Mobile review opens directly into a compact room shell

- **WHEN** the operator opens the review example on an iPhone-class viewport
- **THEN** the route shows compact room-level chrome with title, room summary, and setup entry
- **AND** setup/configuration does not dominate the first viewport
- **AND** the transcript is the primary visible surface below that chrome

#### Scenario: Mobile review shell keeps transcript rows and composer in one visual family

- **WHEN** the operator opens the review example on an iPhone-class viewport
- **THEN** transcript row alignment, bubble metadata, and viewer/participant ownership read as one Framework7 message system
- **AND** the composer input, pending resource rail, and action buttons stay visually attached as one `Messagebar` stack
- **AND** uploaded/comment resource tiles do not overlap, clip, or float as a detached strip

#### Scenario: Desktop does not promote setup into a competing primary panel

- **WHEN** the operator opens the review example on a wide desktop viewport
- **THEN** the room transcript and composer remain the primary visible system
- **AND** review setup remains available through room actions or secondary detail surfaces
- **AND** the shell does not introduce a persistent setup panel that changes the chat coordinate system or revives a second visual language

### Requirement: Shared transcript rows SHALL use one visible bubble law

Transcript rows SHALL not stack a second custom message bubble inside the Framework7 message bubble. Sent-message resource projection SHALL also stay inside that same visible bubble law instead of escaping into adjacent sibling chrome.

#### Scenario: A sent or received message renders as one bubble surface

- **WHEN** the transcript renders a normal text message
- **THEN** the row shows one visible message bubble
- **AND** sender/time metadata does not create a second nested bubble
- **AND** sent-message resources render inside the same bubble content flow through lightweight tokens and an aggregated in-bubble resource bar

### Requirement: Shared chat surfaces SHALL follow Framework7 mobile density

Composer and comment-detail surfaces SHALL read as the same Framework7/iOS app family as the example shell.

#### Scenario: Composer remains a compact messagebar-style surface

- **WHEN** the operator focuses the draft composer
- **THEN** the input, attachments rail, and action buttons keep compact mobile-first proportions
- **AND** the draft field does not read like a detached desktop card

#### Scenario: Comment detail remains quiet and readable

- **WHEN** the operator opens comment detail from a comment resource
- **THEN** the sheet uses compact title, segmented mode control, and quiet content cards
- **AND** long source identifiers do not dominate the primary reading surface
- **AND** edit-mode controls and textarea content remain fully visible inside the mobile safe area

### Requirement: Visual review SHALL be route-level evidence for this slice

This slice SHALL treat real route-level screenshots as the primary acceptance artifact for the visual-law work, including temporary-view states and resource activation states.

#### Scenario: Visual acceptance uses real example screenshots

- **WHEN** the operator claims the visual law is aligned
- **THEN** fresh route-level screenshots from the real example URL exist
- **AND** those screenshots cover the base room shell, message actions, resource preview/detail, and token-triggered activation states
- **AND** source-comment edit state is covered by route-level proof so bottom sheets cannot hide the textarea or clip save actions
- **AND** return-to-latest proof covers real route geometry so a top-aligned sparse transcript cannot invert the bottom-anchored scroll coordinate system
- **AND** wide-viewport message action screenshots prove the visible popover remains geometrically attached to the trigger/bubble layer
- **AND** those screenshots are reviewed against official Framework7/iOS component topology and default visual language
- **AND** blueprints or change references are treated only as information-architecture references rather than binding style truth
- **AND** DOM tests are treated as behavior regression evidence rather than visual proof

#### Scenario: Screenshot evidence lands under the canonical review tree

- **WHEN** the operator captures route-level review evidence for the example app
- **THEN** the artifacts land under the expected worktree-local `.screenshot/...` tree
- **AND** the evidence set covers the base room shell, pending resource rail, `?` / `？` help completion, message actions, and resource preview/detail states
- **AND** the screenshot flow does not silently create a second nested package-local screenshot subtree

### Requirement: Visual law SHALL cover the multi-tab people shell
The Framework7 visual acceptance contract SHALL cover the mobile-first people-aware chat app shell. Visual evidence SHALL cover Messages, Contacts, Me, contact detail, source management, source detail, and room chat states.

#### Scenario: Mobile visual proof covers all primary destinations
- **WHEN** the operator claims the redesigned shell is visually aligned
- **THEN** fresh mobile screenshots exist for Messages, Contacts, and Me
- **THEN** the screenshots show bottom tabbar continuity, quiet iOS density, and Framework7 list/page hierarchy
- **THEN** the room chat remains visually consistent with the existing transcript/composer law

#### Scenario: Detail surfaces are reviewed as child pages
- **WHEN** visual evidence is captured for contact detail or source management
- **THEN** those surfaces appear as Framework7 child pages, sheets, or popups instead of dense cards inside the room transcript
- **THEN** child-page screenshots do not keep the primary bottom tabbar visible
- **THEN** contact/source identity facts remain scannable without overwhelming the primary action

#### Scenario: Desktop evidence derives from mobile IA
- **WHEN** wide viewport screenshots are captured
- **THEN** they show adaptation of the same Messages / Contacts / Me model
- **THEN** they do not revive a separate card-heavy desktop dashboard for source or contact management

#### Scenario: Formal-app density is visible on root destinations
- **WHEN** the operator reviews fresh screenshots for root destinations
- **THEN** search, grouped lists, section spacing, and summary rhythm read like a production chat app
- **THEN** the visual hierarchy no longer reads like a prototype shell with excessive empty space or duplicated explanatory copy
