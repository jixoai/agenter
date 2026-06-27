# web-chat-view-review-evidence Specification

## Purpose
TBD - created by archiving change fix-web-chat-view-review-shell-evidence. Update Purpose after archive.
## Requirements
### Requirement: Review shell SHALL hide Framework7 implementation glyph names from visible text

The review shell SHALL render icons as icons or decorative affordances, not as visible literal Framework7 icon names.

#### Scenario: Visible text excludes icon implementation names

- **WHEN** the operator opens the review shell on desktop or iPhone 14
- **THEN** visible page text MUST NOT include raw icon names such as `chat_bubble_2_fill`, `person_2_fill`, `tray_2_fill`, or `ellipsis`
- **AND** the primary navigation and list actions remain accessible by human labels

### Requirement: Mobile child pages SHALL be route-owned complete surfaces

The review shell SHALL render mobile room, contact, profile, source-list, and source-detail states as complete Framework7 child pages instead of partial overlays inside the root tab surface.

#### Scenario: Source detail owns the iPhone child viewport

- **WHEN** the operator opens source detail from the iPhone 14 review shell
- **THEN** the active child page MUST be visible as a complete Framework7 page
- **AND** the previous root destination MUST NOT remain visibly exposed as an offset background
- **AND** the root bottom tabbar MUST be suspended until the operator returns from the child page

### Requirement: Resource preview entrypoints SHALL be automation-stable and accessible

Inline resource tokens and in-bubble resource tiles SHALL expose stable accessible activation paths for both users and screenshot automation.

#### Scenario: Inline image token opens the shared preview layer

- **WHEN** the operator activates the inline token for `Image 1`
- **THEN** the shared resource preview layer MUST open for the same image resource
- **AND** the automation entrypoint MUST use a stable accessible label that does not depend on raw Markdown punctuation

#### Scenario: Aggregated resource tile opens the shared preview layer

- **WHEN** the operator activates the aggregated image or file tile for a sent message resource
- **THEN** the shared resource preview layer MUST open for the same resolved resource family
- **AND** the screenshot script can capture that state without locator ambiguity

### Requirement: Review evidence report SHALL be generated from fresh route screenshots

The final review artifact SHALL be a self-contained HTML story that references fresh screenshots captured from the real example route.

#### Scenario: HTML report uses same-run desktop and mobile screenshots

- **WHEN** the operator completes this change
- **THEN** the evidence directory MUST contain a generated `index.html`
- **AND** it MUST reference screenshots from the same run for desktop and iPhone 14 primary/child states
- **AND** it MUST describe fixed findings, remaining risks, and the relation to the room-management multi-system direction in plain language
