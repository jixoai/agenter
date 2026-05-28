# web-chat-view-framework7-component-system Specification

## Purpose
Define the durable Framework7-based component-system law for the mobile-first `web-chat-view` review surface, including ownership tiers, resource-first message projection, and host-neutral handling of runtime-gated temporary views.
## Requirements
### Requirement: Web chat view SHALL define Framework7 component ownership tiers

The `web-chat-view` review system SHALL classify visible UI into explicit Framework7 ownership tiers so future implementation work does not regress into mixed shell/card/custom styling. The system SHALL distinguish between direct official Framework7 atoms, runtime-gated Framework7 temporary views, same-style custom atoms, and chat-domain composite components.

#### Scenario: Official Framework7 atoms own canonical shell and chat primitives

- **WHEN** the review shell or shared chat surface needs app shell, list, input, transcript, or composer primitives
- **THEN** it uses the canonical official Framework7 atoms first
- **AND** it does not hand-roll an equivalent private primitive on the critical path

#### Scenario: IA references do not override official Framework7 style law

- **WHEN** change blueprints, screenshots, or design references describe the people shell information architecture
- **THEN** those references guide destination structure, capability boundaries, and flow sequencing only
- **AND** they do not override the official Framework7 component family as the visible style truth
- **AND** any conflict is resolved in favor of verifiable official Framework7 composition and default component behavior

#### Scenario: Runtime-heavy temporary views stay explicitly gated

- **WHEN** the shared package needs popup, sheet, action-sheet, or popover behavior
- **THEN** it may use the official Framework7 temporary view only when a real Framework7 app runtime owns the surface
- **AND** host-neutral embedding paths remain functional without making Framework7 app runtime a hidden requirement

#### Scenario: Chat-specific gaps are filled by named composites instead of ad hoc page markup

- **WHEN** Framework7 does not provide the right atomic unit for resource tiles, inline tokens, comment anchors, or source-selection projection
- **THEN** the implementation builds named same-style atoms and explicit composite components
- **AND** those components follow Framework7 visual and interaction law instead of reviving the old private renderer stack

### Requirement: Web chat view SHALL be mobile-first and desktop-adaptive

The canonical chat system SHALL be designed first for compact/mobile viewports and only then adapted to wider layouts. Desktop SHALL reuse the same component law rather than introducing a separate card-heavy visual system.

#### Scenario: Compact viewport opens directly into a canonical chat surface

- **WHEN** the review shell opens on an iPhone-class viewport
- **THEN** the transcript is visible as the primary surface directly below a compact navbar
- **AND** the composer remains bottom-anchored through the Messagebar law
- **AND** setup or auxiliary flows use sheet, popup, or action-sheet semantics instead of floating desktop cards

#### Scenario: Desktop remains the same system with wider affordances

- **WHEN** the review shell opens on a desktop viewport
- **THEN** it adapts from the same mobile-first component system
- **AND** persistent panels, popovers, or wider popups do not create a second independent visual language

### Requirement: Web chat view SHALL use a resource-first conversation projection

Draft state and sent-message state SHALL share one resource projection law. Structured resources SHALL aggregate in shelves, while message body content SHALL remain lightweight through inline tokens. In sent-message state, the transcript SHALL derive both inline tokens and the aggregated resource bar from the same source-Markdown projection inside the message bubble instead of delegating sent resources to a sibling attachment strip outside the bubble.

#### Scenario: Pending resources aggregate above the draft editor

- **WHEN** the operator adds image, file, video, screenshot, or comment resources while editing
- **THEN** those resources appear in a composer resource rail above the editor
- **AND** each item is represented by the unified square-tile primitive

#### Scenario: Sent resources aggregate inside the message projection

- **WHEN** a message containing structured resources is rendered in the transcript
- **THEN** the body shows lightweight inline tokens instead of large embedded media cards
- **AND** the message renders those resources again in an aggregated bar that remains inside the bubble's CodeMirror-backed message projection
- **AND** the transcript does not render sent-state resources from a sibling strip outside the message bubble

#### Scenario: Resource detail opens from any sent-message affordance through one top-layer contract

- **WHEN** the operator opens a resource from an inline token or from the sent-message aggregated resource bar
- **THEN** the detail surface opens through one shared preview shell contract for that resolved resource
- **AND** the system does not fork into separate token-only, tile-only, or kind-specific overlay families

#### Scenario: Comment resources reopen into a dedicated comment detail surface

- **WHEN** the operator opens a comment resource from the composer rail or the sent-message aggregated resource bar
- **THEN** the system opens a dedicated comment detail stage inside the shared preview shell instead of the generic file/image document stage
- **AND** that surface defaults to `view`
- **AND** it keeps the selected-text anchor summary and stored comment body visible in the same review contract

### Requirement: Web chat view SHALL treat completion and selected-text actions as first-class interaction systems

Completion and selection actions SHALL be defined through Framework7-compatible interaction primitives instead of residual private dropdown/menu logic. The canonical review shell SHALL also provide a real review-route proof path for these interactions so mixed completion, upload preview, source inspection, and comment-resource roundtrip can be judged from route-level behavior instead of inferred only from isolated tests.

#### Scenario: Trigger completion uses the shared trigger-provider input law today

- **WHEN** the operator types `@`, `^`, or `/` in the composer
- **THEN** the system resolves suggestions through the trigger/provider contract
- **AND** the visible interaction stays inside the shared host-neutral input/editor surface
- **AND** token insertion adds surrounding spaces when needed

#### Scenario: Larger completion sets can later escalate through official Framework7 pickers

- **WHEN** the suggestion set becomes too large or categorical for the compact inline surface
- **THEN** the system may escalate through official Framework7 `Autocomplete`, popup/page selection, or `Smart Select`
- **AND** that escalation remains a follow-up enhancement rather than a hidden runtime requirement for the first shared-package slice

#### Scenario: Selected-text actions use canonical temporary-view law

- **WHEN** the operator long-presses or double-activates message text for selection
- **THEN** the system opens selected-text actions through action-sheet or popover semantics according to viewport/runtime
- **AND** the operator can trigger copy, share, or comment without introducing a separate non-Framework7 action system

#### Scenario: Raw Markdown inspection uses a dedicated source popup

- **WHEN** the operator inspects the raw Markdown/source form of a message
- **THEN** the system opens a dedicated source popup with close, copy, sender identity, and time context
- **AND** the selected line/range remains the default focus for follow-up actions

#### Scenario: Source-selected comments reopen with the same anchor continuity

- **WHEN** the operator creates a comment from the source popup and later reopens that comment from a resource shelf
- **THEN** the reopened comment detail keeps the same selected-text anchor summary captured at creation time
- **AND** the operator can switch between explicit `view` and `edit` modes inside that same comment-detail contract

#### Scenario: Real review route proves mixed completion and resource roundtrip

- **WHEN** the operator runs the canonical review-flow proof against the real Framework7 review route
- **THEN** the proof verifies participant completion, resource completion, upload-rail preview, and comment-resource roundtrip on that route
- **AND** the resulting proof artifact is stored under the route-level screenshot evidence tree instead of being treated as a DOM-only assertion

### Requirement: People shell SHALL compose official Framework7 navigation and list atoms
The people-aware review shell SHALL use official Framework7 component families for primary navigation and list/detail surfaces before introducing custom same-style components. Custom components SHALL be limited to chat-domain or message-system-domain composites that Framework7 does not provide directly.

#### Scenario: Primary destinations use Framework7 tabbar and pages
- **WHEN** the example shell renders `Messages`, `Contacts`, and `Me`
- **THEN** the primary navigation uses Framework7 `Toolbar / Tabbar`, `View`, `Page`, and `Navbar` semantics
- **AND** the compact root tabbar follows the official toolbar topology for the active Framework7 version, including `ToolbarPane` when that component family owns the inner layout
- **THEN** the implementation does not replace them with an unrelated private tab shell
- **THEN** the primary tabbar is visible only for root destinations, while child pages use the Navbar back affordance

#### Scenario: People and source rows use Framework7 list families
- **WHEN** the shell renders conversation rows, contacts, requests, sources, or profile settings
- **THEN** it uses Framework7 `List`, `List Item`, `Contacts List`, `Swipeout`, `Badge`, `Chips / Tags`, or `Skeleton` semantics where they fit
- **THEN** same-style custom atoms are introduced only for message-system specific composites such as source trust status or direct-room linkage

#### Scenario: Secondary people actions use Framework7 temporary views
- **WHEN** the operator opens add-contact, request handling, source edit, source detail, profile setup, or room actions
- **THEN** compact/mobile flows use Framework7 `Sheet Modal`, `Popup`, `Actions`, `Popover`, `Dialog`, or `Searchbar` semantics according to the interaction
- **THEN** those temporary views are root-owned by the Framework7 runtime rather than clipped under transcript or list containers

#### Scenario: Framework7 atoms own shell topology before local wrappers
- **WHEN** a visible shell responsibility matches an official Framework7 page, view, navbar, toolbar, tabbar, message, messagebar, or list family
- **THEN** that official component family owns the topology first
- **THEN** local wrappers may refine styling or data plumbing without replacing the structural responsibility
- **THEN** the shell does not layer a second private topology around the same responsibility unless Framework7 lacks the primitive entirely
